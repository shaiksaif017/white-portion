// Server functions for booking and admin. The handler bodies run only on the server;
// the browser just gets a small RPC stub for each one.
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import { type SlotAvailability } from "@/lib/booking-logic";
import {
  type AppointmentRecord,
  type BookingSettings,
  type PublicBookingSettings,
  BookingSchema,
  BookingSettingsSchema,
  defaultBookingSettings,
  toPublicSettings,
} from "@/lib/booking-types";
import {
  type NotificationLog,
  buildAdminAlert,
  buildCancellation,
  buildConfirmation,
  buildCustomerAcknowledgement,
} from "@/lib/notifications";
import { rateLimit } from "@/server/auth";
import { throttle } from "@/server/throttle";
import * as bookings from "@/server/bookings";
import { isDbConfigured } from "@/server/db";
import { adminFor } from "@/server/admin-session";
import { securityAlert } from "@/server/audit";
import { resolveSmtp, saveSmtpPassword, sendEmail, sendEmails, smtpSummary } from "@/server/mailer";
import { toWhatsAppDigits } from "@/lib/notifications";
import {
  CANCEL_TEMPLATE_TEXT,
  CONFIRM_TEMPLATE_TEXT,
  cancelParams,
  confirmParams,
} from "@/lib/whatsapp-templates";
import { sendAppointmentWhatsApp } from "@/server/whatsapp-cloud";

const UNAVAILABLE = "Online booking is temporarily unavailable. Please contact us on WhatsApp.";

function clientIp(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

type Fail = { ok: false; error: string };

// ---------- public ----------

export const getPublicBookingSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ bookingEnabled: boolean; settings: PublicBookingSettings }> => {
    if (!isDbConfigured()) {
      return { bookingEnabled: false, settings: toPublicSettings(defaultBookingSettings) };
    }
    try {
      return { bookingEnabled: true, settings: toPublicSettings(await bookings.getSettings()) };
    } catch (error) {
      console.error("[booking] settings unavailable", error);
      return { bookingEnabled: false, settings: toPublicSettings(defaultBookingSettings) };
    }
  },
);

export const getSlotsForDate = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; slots: SlotAvailability[] } | Fail> => {
    if (!rateLimit(`slots:${clientIp()}`, 120, 60_000)) {
      return { ok: false, error: "Too many requests. Please wait a minute." };
    }
    try {
      return { ok: true, slots: await bookings.getSlots(data.date) };
    } catch (error) {
      console.error("[booking] slots failed", error);
      return { ok: false, error: UNAVAILABLE };
    }
  });

export const submitBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<{ ok: true; appointment: AppointmentRecord } | Fail> => {
    const parsed = BookingSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
    }
    if (!rateLimit(`book:${clientIp()}`, 5, 15 * 60_000)) {
      return {
        ok: false,
        error: "Too many booking attempts. Please try again later or contact us on WhatsApp.",
      };
    }
    if (!(await throttle(`book-email:${parsed.data.email.toLowerCase()}`, 3, 24 * 60 * 60))) {
      return {
        ok: false,
        error:
          "You've already sent several requests today. We'll be in touch, or message us on WhatsApp.",
      };
    }
    try {
      const result = await bookings.createAppointment(parsed.data);
      if (!result.ok) return result;
      // Send emails in the background so the customer is not kept waiting.
      void sendEmails([
        { message: buildCustomerAcknowledgement(result.appointment, result.settings) },
        {
          message: buildAdminAlert(result.appointment, result.settings),
          replyTo: result.appointment.email,
        },
      ]);
      return { ok: true, appointment: result.appointment };
    } catch (error) {
      console.error("[booking] create failed", error);
      return { ok: false, error: UNAVAILABLE };
    }
  });

// Admin login, 2FA and sessions live in src/lib/admin-auth-api.ts.

// ---------- admin data ----------

export const getAdminDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    | {
        ok: true;
        appointments: AppointmentRecord[];
        settings: BookingSettings;
        notifications: NotificationLog[];
      }
    | Fail
  > => {
    const admin = await adminFor("bookings");
    if (!admin.ok) return admin;
    try {
      const [appointments, settings, notifications] = await Promise.all([
        bookings.listAppointments(),
        bookings.getSettings(),
        bookings.listNotifications(),
      ]);
      return { ok: true, appointments, settings, notifications };
    } catch (error) {
      console.error("[admin] dashboard failed", error);
      return { ok: false, error: "Could not load data from the database." };
    }
  },
);

export const adminUpdateStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["Pending", "Confirmed", "Cancelled", "Completed"]),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; appointment: AppointmentRecord; notified: StatusNotifications | null } | Fail
    > => {
      const admin = await adminFor("bookings");
      if (!admin.ok) return admin;
      try {
        const result = await bookings.updateAppointmentStatus(data.id, data.status);
        if (!result.ok) return result;
        const { appointment, previousStatus } = result;
        let notified: StatusNotifications | null = null;
        const status = appointment.booking_status;
        if (previousStatus !== status && (status === "Confirmed" || status === "Cancelled")) {
          // Email and WhatsApp go out together; the admin sees how each one went.
          const settings = await bookings.getSettings();
          const confirm = status === "Confirmed";
          const to =
            toWhatsAppDigits(appointment.whatsapp_number) ?? toWhatsAppDigits(appointment.phone);
          const [email, whatsapp] = await Promise.all([
            sendEmail(
              confirm
                ? buildConfirmation(appointment, settings)
                : buildCancellation(appointment, settings),
            ),
            sendAppointmentWhatsApp({
              type: confirm ? "WHATSAPP_CONFIRMATION" : "WHATSAPP_CANCELLATION",
              to,
              which: confirm ? "confirm" : "cancel",
              params: confirm ? confirmParams(appointment, settings) : cancelParams(appointment),
              templateText: confirm ? CONFIRM_TEMPLATE_TEXT : CANCEL_TEMPLATE_TEXT,
            }),
          ]);
          notified = { email, whatsapp };
        }
        if (previousStatus !== appointment.booking_status) {
          await admin.log("booking.status", appointment.booking_reference, {
            from: previousStatus,
            to: appointment.booking_status,
            email: notified?.email.status,
            whatsapp: notified?.whatsapp.status,
          });
        }
        return { ok: true, appointment, notified };
      } catch (error) {
        console.error("[admin] status update failed", error);
        return { ok: false, error: "Could not update the booking." };
      }
    },
  );

export interface StatusNotifications {
  email: { status: "SENT" | "FAILED" | "SKIPPED"; error?: string | undefined };
  whatsapp: { status: "SENT" | "FAILED" | "SKIPPED"; error?: string | undefined };
}

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<{ ok: true; settings: BookingSettings } | Fail> => {
    const admin = await adminFor("booking_settings");
    if (!admin.ok) return admin;
    const parsed = BookingSettingsSchema.safeParse(data);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
    try {
      const saved = await bookings.saveSettings(parsed.data);
      await admin.log("settings.booking_hours");
      return { ok: true, settings: saved };
    } catch (error) {
      console.error("[admin] save settings failed", error);
      return { ok: false, error: "Could not save settings." };
    }
  });

const slotInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const adminSetSlotBlocked = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slotInput.extend({ blocked: z.boolean() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; settings: BookingSettings } | Fail> => {
    const admin = await adminFor("booking_settings");
    if (!admin.ok) return admin;
    try {
      const settings = await bookings.getSettings();
      const others = settings.blockedSlots.filter(
        (s) => !(s.date === data.date && s.time === data.time),
      );
      settings.blockedSlots = data.blocked
        ? [...others, { date: data.date, time: data.time }]
        : others;
      const saved = await bookings.saveSettings(settings);
      await admin.log(
        data.blocked ? "booking.slot_blocked" : "booking.slot_unblocked",
        `${data.date} ${data.time}`,
      );
      return { ok: true, settings: saved };
    } catch (error) {
      console.error("[admin] block slot failed", error);
      return { ok: false, error: "Could not update blocked slots." };
    }
  });

type TestEmailResult =
  | {
      ok: true;
      result: "SENT" | "FAILED" | "SKIPPED";
      error?: string | undefined;
      to: string;
      smtp: ReturnType<typeof smtpSummary>;
    }
  | Fail;

async function runTestEmail(): Promise<TestEmailResult> {
  const settings = await bookings.getSettings();
  const to = settings.adminNotificationEmail;
  const res = await sendEmail({
    type: "TEST_EMAIL",
    to,
    subject: "Test email from your White Portion Wellness website",
    text: "This is a test email from your website's admin portal.\n\nIf you can read this, booking emails are working.",
  });
  return {
    ok: true,
    result: res.status,
    error: res.error,
    to,
    smtp: smtpSummary(await resolveSmtp()),
  };
}

export const adminSendTestEmail = createServerFn({ method: "POST" }).handler(
  async (): Promise<TestEmailResult> => {
    const admin = await adminFor("settings");
    if (!admin.ok) return admin;
    try {
      return await runTestEmail();
    } catch (error) {
      console.error("[admin] test email failed", error);
      return { ok: false, error: "Could not run the email test." };
    }
  },
);

// Owner sets the mailbox password here instead of in Hostinger's settings. It is
// stored encrypted and never sent back to the browser.
export const adminSetEmailPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<TestEmailResult> => {
    const admin = await adminFor("settings");
    if (!admin.ok) return admin;
    if (!rateLimit(`smtp-pass:${clientIp()}`, 10, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait 15 minutes." };
    }
    try {
      await saveSmtpPassword(data.password);
      await admin.log("settings.email_password_changed");
      void securityAlert("Email password changed", [
        `${admin.user.email} changed the email account password in admin.`,
      ]);
      return await runTestEmail();
    } catch (error) {
      console.error("[admin] save email password failed", error);
      return { ok: false, error: "Could not save the email password." };
    }
  });

export const adminExportCsv = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; csv: string } | Fail> => {
    const admin = await adminFor("bookings");
    if (!admin.ok) return admin;
    try {
      return {
        ok: true,
        csv: bookings.appointmentsToCsv(await bookings.listAppointments(100_000)),
      };
    } catch (error) {
      console.error("[admin] export failed", error);
      return { ok: false, error: "Could not export bookings." };
    }
  },
);
