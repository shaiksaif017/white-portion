// Admin server functions for automatic WhatsApp (Cloud API) settings.
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import { toWhatsAppDigits } from "@/lib/notifications";
import { CONFIRM_TEMPLATE_TEXT } from "@/lib/whatsapp-templates";
import { adminFor } from "@/server/admin-session";
import { securityAlert } from "@/server/audit";
import { rateLimit } from "@/server/auth";
import { getSettings } from "@/server/bookings";
import {
  type WhatsAppConfig,
  getWhatsAppConfig,
  hasWhatsAppToken,
  saveWhatsAppConfig,
  saveWhatsAppToken,
  sendAppointmentWhatsApp,
} from "@/server/whatsapp-cloud";

type Fail = { ok: false; error: string };
const unauthorized: Fail = { ok: false, error: "Your session has expired. Please log in again." };

export interface WhatsAppSettingsView extends WhatsAppConfig {
  hasToken: boolean;
}

async function view(): Promise<WhatsAppSettingsView> {
  const [config, hasToken] = await Promise.all([getWhatsAppConfig(), hasWhatsAppToken()]);
  return { ...config, hasToken };
}

export const adminGetWhatsAppSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; settings: WhatsAppSettingsView } | Fail> => {
    const admin = await adminFor("settings");
    if (!admin.ok) return admin;
    try {
      return { ok: true, settings: await view() };
    } catch (error) {
      console.error("[admin] whatsapp settings failed", error);
      return { ok: false, error: "Could not load WhatsApp settings." };
    }
  },
);

const templateName = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{1,512}$/, "Template names use only lowercase letters, numbers and _");

export const adminSaveWhatsAppSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        phoneNumberId: z
          .string()
          .trim()
          .regex(/^\d{6,30}$|^$/, "The Phone number ID is a long number from WhatsApp Manager"),
        confirmTemplate: templateName,
        cancelTemplate: templateName,
        language: z
          .string()
          .trim()
          .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Language code looks like en or en_US"),
        token: z.string().trim().max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; settings: WhatsAppSettingsView } | Fail> => {
    const admin = await adminFor("settings");
    if (!admin.ok) return admin;
    try {
      const { token, ...config } = data;
      if (token) {
        if (token.length < 50) return { ok: false, error: "The access token looks too short." };
        await saveWhatsAppToken(token);
      }
      if (config.enabled && (!config.phoneNumberId || !(token || (await hasWhatsAppToken())))) {
        return {
          ok: false,
          error:
            "Enter the Phone number ID and access token before switching automatic WhatsApp on.",
        };
      }
      await saveWhatsAppConfig(config);
      await admin.log("settings.whatsapp", undefined, {
        enabled: config.enabled,
        tokenChanged: Boolean(token) || undefined,
      });
      if (token)
        void securityAlert("WhatsApp token changed", [
          `${admin.user.email} replaced the WhatsApp access token.`,
        ]);
      return { ok: true, settings: await view() };
    } catch (error) {
      console.error("[admin] save whatsapp settings failed", error);
      return { ok: false, error: "Could not save WhatsApp settings." };
    }
  });

// Sends the confirmation template with sample details to a number the owner types in.
export const adminSendWhatsAppTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: z.string().trim().max(30) }).parse(d))
  .handler(
    async ({ data }): Promise<{ ok: true; status: string; error?: string | undefined } | Fail> => {
      const admin = await adminFor("settings");
      if (!admin.ok) return admin;
      if (
        !rateLimit(`wa-test:${getRequestIP({ xForwardedFor: true }) ?? "unknown"}`, 10, 15 * 60_000)
      )
        return { ok: false, error: "Too many tests. Please wait 15 minutes." };
      const to = toWhatsAppDigits(data.phone);
      if (!to) return { ok: false, error: "Enter a valid mobile number, e.g. 98765 43210." };
      try {
        const config = await getWhatsAppConfig();
        if (!config.enabled) {
          return { ok: false, error: "Switch automatic WhatsApp on and save first." };
        }
        const settings = await getSettings();
        const params = [
          "Test",
          "Personalised Diet Planning",
          "Monday, 1 January 2030",
          "10:00 AM (India Standard Time)",
          `In-person at ${settings.businessLocation}`.replace(/\s+/g, " "),
          "WPW-TEST",
          "This is a test message from your website.",
        ];
        const r = await sendAppointmentWhatsApp({
          type: "WHATSAPP_TEST",
          to,
          which: "confirm",
          params,
          templateText: CONFIRM_TEMPLATE_TEXT,
        });
        return { ok: true, status: r.status, error: r.error };
      } catch (error) {
        console.error("[admin] whatsapp test failed", error);
        return { ok: false, error: "Could not run the WhatsApp test." };
      }
    },
  );
