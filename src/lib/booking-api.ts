// Server functions for booking and admin. The handler bodies run only on the server;
// the browser just gets a small RPC stub for each one.
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
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
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  createSessionToken,
  rateLimit,
  resetRateLimit,
  verifyPassword,
  verifySessionToken,
} from "@/server/auth";
import * as bookings from "@/server/bookings";
import { isDbConfigured } from "@/server/db";
import { authConfig, isProduction } from "@/server/env";
import { sendEmail, sendEmails, smtpSummary } from "@/server/mailer";

const UNAVAILABLE = "Online booking is temporarily unavailable. Please contact us on WhatsApp.";

function clientIp(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

function isAdmin(): boolean {
  return verifySessionToken(getCookie(SESSION_COOKIE));
}

type Fail = { ok: false; error: string };
const unauthorized: Fail = { ok: false, error: "Your session has expired. Please log in again." };

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

// ---------- admin auth ----------

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => ({
  authenticated: isAdmin(),
  configured: authConfig() !== null && isDbConfigured(),
}));

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const config = authConfig();
    if (!config) {
      return {
        ok: false,
        error:
          "Admin login is not set up on the server yet (ADMIN_PASSWORD_HASH / SESSION_SECRET).",
      };
    }
    const key = `login:${clientIp()}`;
    if (!rateLimit(key, 5, 15 * 60_000)) {
      return {
        ok: false,
        error: "Too many failed attempts. Please wait 15 minutes and try again.",
      };
    }
    if (!verifyPassword(data.password, config.passwordHash)) {
      return { ok: false, error: "Incorrect password." };
    }
    resetRateLimit(key);
    const token = createSessionToken();
    if (!token) return { ok: false, error: "Admin login is not set up on the server yet." };
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_HOURS * 3600,
    });
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true as const };
});

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
    if (!isAdmin()) return unauthorized;
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
  .handler(async ({ data }): Promise<{ ok: true; appointment: AppointmentRecord } | Fail> => {
    if (!isAdmin()) return unauthorized;
    try {
      const result = await bookings.updateAppointmentStatus(data.id, data.status);
      if (!result.ok) return result;
      const { appointment, previousStatus } = result;
      if (previousStatus !== appointment.booking_status) {
        const settings = await bookings.getSettings();
        if (appointment.booking_status === "Confirmed") {
          void sendEmails([{ message: buildConfirmation(appointment, settings) }]);
        } else if (appointment.booking_status === "Cancelled") {
          void sendEmails([{ message: buildCancellation(appointment, settings) }]);
        }
      }
      return { ok: true, appointment };
    } catch (error) {
      console.error("[admin] status update failed", error);
      return { ok: false, error: "Could not update the booking." };
    }
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<{ ok: true; settings: BookingSettings } | Fail> => {
    if (!isAdmin()) return unauthorized;
    const parsed = BookingSettingsSchema.safeParse(data);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
    try {
      return { ok: true, settings: await bookings.saveSettings(parsed.data) };
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
    if (!isAdmin()) return unauthorized;
    try {
      const settings = await bookings.getSettings();
      const others = settings.blockedSlots.filter(
        (s) => !(s.date === data.date && s.time === data.time),
      );
      settings.blockedSlots = data.blocked
        ? [...others, { date: data.date, time: data.time }]
        : others;
      return { ok: true, settings: await bookings.saveSettings(settings) };
    } catch (error) {
      console.error("[admin] block slot failed", error);
      return { ok: false, error: "Could not update blocked slots." };
    }
  });

export const adminSendTestEmail = createServerFn({ method: "POST" }).handler(
  async (): Promise<
    | {
        ok: true;
        result: "SENT" | "FAILED" | "SKIPPED";
        error?: string | undefined;
        to: string;
        smtp: { host: string; port: number; user: string; from: string } | null;
      }
    | Fail
  > => {
    if (!isAdmin()) return unauthorized;
    try {
      const settings = await bookings.getSettings();
      const to = settings.adminNotificationEmail;
      const res = await sendEmail({
        type: "TEST_EMAIL",
        to,
        subject: "Test email from your White Portion Wellness website",
        text: "This is a test email from your website's admin portal.\n\nIf you can read this, booking emails are working.",
      });
      return { ok: true, result: res.status, error: res.error, to, smtp: smtpSummary() };
    } catch (error) {
      console.error("[admin] test email failed", error);
      return { ok: false, error: "Could not run the email test." };
    }
  },
);

export const adminExportCsv = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; csv: string } | Fail> => {
    if (!isAdmin()) return unauthorized;
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
