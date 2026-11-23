// Sends WhatsApp template messages through Meta's WhatsApp Cloud API and records
// every attempt in the notification log. A failed WhatsApp never blocks a booking update.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
import type { NotificationType } from "@/lib/notifications";
import {
  DEFAULT_CANCEL_TEMPLATE,
  DEFAULT_CONFIRM_TEMPLATE,
  fillTemplate,
} from "@/lib/whatsapp-templates";
import { logNotification } from "./bookings";
import { getSecret, setSecret } from "./secrets";

const GRAPH = "https://graph.facebook.com/v23.0";
const TOKEN_SECRET = "whatsapp_access_token";
const CONFIG_SECRET = "whatsapp_config";

export interface WhatsAppConfig {
  enabled: boolean;
  phoneNumberId: string;
  confirmTemplate: string;
  cancelTemplate: string;
  language: string; // template language code, e.g. "en" or "en_US"
}

export const defaultWhatsAppConfig: WhatsAppConfig = {
  enabled: false,
  phoneNumberId: "",
  confirmTemplate: DEFAULT_CONFIRM_TEMPLATE,
  cancelTemplate: DEFAULT_CANCEL_TEMPLATE,
  language: "en",
};

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const raw = await getSecret(CONFIG_SECRET);
  if (!raw) return defaultWhatsAppConfig;
  try {
    return { ...defaultWhatsAppConfig, ...(JSON.parse(raw) as Partial<WhatsAppConfig>) };
  } catch {
    return defaultWhatsAppConfig;
  }
}

export async function saveWhatsAppConfig(c: WhatsAppConfig): Promise<void> {
  await setSecret(CONFIG_SECRET, JSON.stringify(c));
}

export async function hasWhatsAppToken(): Promise<boolean> {
  return (await getSecret(TOKEN_SECRET)) !== null;
}

export async function saveWhatsAppToken(token: string): Promise<void> {
  await setSecret(TOKEN_SECRET, token);
}

export interface WhatsAppResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string | undefined;
}

// Turns Meta's error into a plain-English reason for the admin.
function describe(err: {
  message?: string;
  code?: number;
  error_data?: { details?: string };
}): string {
  const hints: Record<number, string> = {
    190: "The access token is invalid or has expired. Paste a new permanent token in admin.",
    131026: "This number is not on WhatsApp, or can't receive messages.",
    131047: "More than 24 hours since the customer's last message; a template is required.",
    131056: "Too many messages to this number in a short time.",
    132000:
      "The template's number of values doesn't match. Check the template text in WhatsApp Manager.",
    132001: "Template not found. Check the template name and language, and that Meta approved it.",
    132015: "The template is paused by Meta due to low quality.",
    133010: "The business phone number isn't registered with the Cloud API yet.",
    100: "Invalid request. Check the Phone number ID.",
  };
  const hint = err.code !== undefined ? hints[err.code] : undefined;
  return [hint, err.message, err.error_data?.details, err.code ? `code ${err.code}` : undefined]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 480);
}

export async function sendTemplate(
  to: string, // international digits, e.g. 919876543210
  template: string,
  params: string[],
  language: string,
  phoneNumberId: string,
  token: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: [
            { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
          ],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number; error_data?: { details?: string } };
    };
    if (!res.ok || !json.messages?.[0]) {
      return { ok: false, error: describe(json.error ?? { message: `HTTP ${res.status}` }) };
    }
    return { ok: true, id: json.messages[0].id };
  } catch (e) {
    return {
      ok: false,
      error: `Could not reach WhatsApp: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// Sends one appointment message if WhatsApp is switched on; always logs the outcome.
export async function sendAppointmentWhatsApp(opts: {
  type: NotificationType;
  to: string | null;
  which: "confirm" | "cancel";
  params: string[];
  templateText: string;
}): Promise<WhatsAppResult> {
  let result: WhatsAppResult;
  let template = "";
  try {
    const [config, token] = await Promise.all([getWhatsAppConfig(), getSecret(TOKEN_SECRET)]);
    template = opts.which === "confirm" ? config.confirmTemplate : config.cancelTemplate;
    if (!config.enabled || !token || !config.phoneNumberId) {
      result = { status: "SKIPPED", error: "Automatic WhatsApp is not switched on" };
    } else if (!opts.to) {
      result = {
        status: "FAILED",
        error: "The customer's phone number isn't a valid WhatsApp number",
      };
    } else {
      const r = await sendTemplate(
        opts.to,
        template,
        opts.params,
        config.language,
        config.phoneNumberId,
        token,
      );
      result = r.ok ? { status: "SENT" } : { status: "FAILED", error: r.error };
    }
  } catch (e) {
    result = { status: "FAILED", error: e instanceof Error ? e.message : String(e) };
  }
  if (result.status === "FAILED") console.error("[whatsapp] send failed", opts.type, result.error);

  try {
    await logNotification({
      type: opts.type,
      recipient: opts.to ? `WhatsApp +${opts.to}` : "WhatsApp (no number)",
      subject: `WhatsApp template: ${template || opts.which}`,
      content: fillTemplate(opts.templateText, opts.params),
      status: result.status,
      error: result.error,
    });
  } catch (e) {
    console.error("[whatsapp] could not write notification log", e);
  }
  return result;
}
