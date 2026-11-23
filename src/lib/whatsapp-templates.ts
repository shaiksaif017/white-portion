// WhatsApp message templates for automatic appointment updates (WhatsApp Cloud API).
// Businesses may only start a WhatsApp conversation with a template Meta has approved.
// The owner creates these two templates in WhatsApp Manager with EXACTLY this text
// (category "Utility", language English); the numbered {{n}} values are filled in here.
import type { AppointmentRecord, BookingSettings } from "./booking-types";
import { brand } from "./brand";
import { formatLongDate, formatTime12h } from "./notifications";

export const DEFAULT_CONFIRM_TEMPLATE = "appointment_confirmed";
export const DEFAULT_CANCEL_TEMPLATE = "appointment_cancelled";

export const CONFIRM_TEMPLATE_TEXT = `Dear {{1}}, your appointment with ${brand.name} is confirmed.

Service: {{2}}
Date: {{3}}
Time: {{4}}
Consultation: {{5}}
Booking reference: {{6}}

{{7}}

Need to reschedule? Simply reply to this message.`;

export const CANCEL_TEMPLATE_TEXT = `Dear {{1}}, your ${brand.name} consultation on {{2}} at {{3}} (reference {{4}}) has been cancelled.

If you would like to book a new time, simply reply to this message or visit our website.`;

// WhatsApp rejects template values containing new lines, tabs or 5+ spaces in a row.
function clean(v: string, max = 300): string {
  const s = v
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
  return (s || "-").slice(0, max);
}

export function confirmParams(
  a: AppointmentRecord,
  settings: Pick<BookingSettings, "businessLocation">,
): string[] {
  const inPerson = a.appointment_type === "In-Person Consultation";
  return [
    a.full_name.split(" ")[0] || a.full_name,
    a.service,
    formatLongDate(a.appointment_date),
    `${formatTime12h(a.appointment_time)} (India Standard Time)`,
    inPerson
      ? `In-person at ${settings.businessLocation}`
      : "Online video call (we will share your private link before the session)",
    a.booking_reference,
    inPerson
      ? "Please arrive 5 minutes before your scheduled time."
      : "Please join from a quiet place with a stable internet connection.",
  ].map((v) => clean(v));
}

export function cancelParams(a: AppointmentRecord): string[] {
  return [
    a.full_name.split(" ")[0] || a.full_name,
    formatLongDate(a.appointment_date),
    `${formatTime12h(a.appointment_time)} IST`,
    a.booking_reference,
  ].map((v) => clean(v));
}

// The message as the customer will see it (for the notification log).
export function fillTemplate(text: string, params: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] ?? "");
}
