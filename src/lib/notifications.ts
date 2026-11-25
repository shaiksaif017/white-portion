// Email templates and WhatsApp links. Pure functions: sending happens on the server
// (src/server/mailer.ts), never in the browser.
import { type AppointmentRecord, type BookingSettings } from "./booking-types";
import { brand } from "./brand";
import { whatsappUrl, WHATSAPP_DISPLAY } from "./whatsapp";

export type NotificationType =
  | "CUSTOMER_ACKNOWLEDGEMENT"
  | "ADMIN_ALERT"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CANCELLED"
  | "TEST_EMAIL"
  | "ORDER_CONFIRMATION"
  | "ORDER_ADMIN_ALERT"
  | "ORDER_SHIPPED"
  | "WHATSAPP_CONFIRMATION"
  | "WHATSAPP_CANCELLATION"
  | "WHATSAPP_TEST"
  | "LOGIN_CODE"
  | "ADMIN_SECURITY";

export interface NotificationLog {
  id: string;
  type: NotificationType;
  recipient: string;
  subject: string;
  content: string;
  sentAt: string;
  // SENT = accepted by the mail server, FAILED = mail server error,
  // SKIPPED = email is not configured on the server yet.
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string | undefined;
}

export interface EmailMessage {
  type: NotificationType;
  to: string;
  subject: string;
  text: string;
  html?: string; // optional formatted version; text is always sent too
}

type Settings = Pick<BookingSettings, "businessLocation" | "adminNotificationEmail">;

function whatsappLink(_settings?: unknown): string {
  return `${WHATSAPP_DISPLAY} (${whatsappUrl()})`;
}

export function buildCustomerAcknowledgement(
  a: AppointmentRecord,
  settings: Settings,
): EmailMessage {
  return {
    type: "CUSTOMER_ACKNOWLEDGEMENT",
    to: a.email,
    subject: `Your ${brand.name} Consultation Request (${a.booking_reference})`,
    text: `
Dear ${a.full_name},

Thank you for choosing ${brand.name}.

We have received your appointment request. It is currently PENDING REVIEW by our coaching team. We will review your goals and confirm within 24 business hours.

--- REQUEST DETAILS ---
Booking Reference: ${a.booking_reference}
Service: ${a.service}
Appointment Type: ${a.appointment_type}
Requested Date: ${a.appointment_date}
Requested Time: ${a.appointment_time} (${a.timezone})
Fitness Goal: ${a.fitness_goal}

${
  a.appointment_type === "In-Person Consultation"
    ? `Location: ${settings.businessLocation}`
    : "Location: A private video consultation link will be sent once your appointment is confirmed."
}

If you have urgent questions, contact us on WhatsApp:
${whatsappLink(settings)}

Warm regards,
${brand.name}
${brand.tagline}
`.trim(),
  };
}

export function buildAdminAlert(a: AppointmentRecord, settings: Settings): EmailMessage {
  return {
    type: "ADMIN_ALERT",
    to: settings.adminNotificationEmail,
    subject: `[NEW BOOKING] ${a.service} - ${a.full_name} (${a.booking_reference})`,
    text: `
NEW CONSULTATION REQUEST RECEIVED

Reference: ${a.booking_reference}
Client Name: ${a.full_name}
Email: ${a.email}
Phone: ${a.phone}
WhatsApp: ${a.whatsapp_number || "Same as phone"}
Service: ${a.service}
Date & Time: ${a.appointment_date} at ${a.appointment_time} (${a.timezone})
Type: ${a.appointment_type}
Primary Goal: ${a.fitness_goal}
Experience: ${a.training_experience || "Not provided"}
Current Weight / Height: ${a.current_weight || "N/A"} / ${a.height || "N/A"}
Dietary Preferences: ${a.dietary_preferences || "None specified"}
Additional Notes: ${a.additional_information || "None"}
Status: PENDING REVIEW

Log in to the admin portal (/admin) to confirm or cancel this request.
`.trim(),
  };
}

// ---------- formatting helpers (fixed output, independent of server locale) ----------

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// "2026-11-24" -> "Tuesday, 24 November 2026"
export function formatLongDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "14:30" -> "2:30 PM"
export function formatTime12h(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function confirmationDetails(
  a: AppointmentRecord,
  settings: Pick<BookingSettings, "businessLocation">,
) {
  const inPerson = a.appointment_type === "In-Person Consultation";
  return {
    firstName: a.full_name.split(" ")[0] || a.full_name,
    rows: [
      ["Booking reference", a.booking_reference],
      ["Service", a.service],
      ["Date", formatLongDate(a.appointment_date)],
      ["Time", `${formatTime12h(a.appointment_time)} (India Standard Time)`],
      ["Consultation type", inPerson ? "In-person" : "Online video consultation"],
      inPerson
        ? ["Location", settings.businessLocation]
        : ["Meeting link", "We will share your private video link before the session"],
    ] as [string, string][],
    note: inPerson
      ? "Please arrive 5 minutes before your scheduled time."
      : "Please join from a quiet place with a stable internet connection.",
  };
}

export function buildConfirmation(a: AppointmentRecord, settings: Settings): EmailMessage {
  const { firstName, rows, note } = confirmationDetails(a, settings);
  const text = [
    `Dear ${firstName},`,
    "",
    `Thank you for choosing ${brand.name}. We are pleased to confirm your appointment.`,
    "",
    "APPOINTMENT DETAILS",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    note,
    "",
    `Need to reschedule or have a question? Reply to this email or message us on WhatsApp at ${whatsappLink(settings)}.`,
    "",
    "We look forward to seeing you.",
    "",
    "Warm regards,",
    `The ${brand.name} Team`,
    brand.tagline,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#2b2b26;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#2b2b26;padding:24px 28px;color:#f4f1ea;font-size:13px;letter-spacing:3px;font-weight:bold;">${escapeHtml(brand.nameUpper)}</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 6px;font-size:13px;color:#4f6b3a;font-weight:bold;letter-spacing:1px;">APPOINTMENT CONFIRMED &#10003;</p>
<p style="margin:0 0 16px;font-size:16px;">Dear ${escapeHtml(firstName)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Thank you for choosing ${escapeHtml(brand.name)}. We are pleased to confirm your appointment.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e1d6;border-radius:6px;font-size:14px;">
${rows
  .map(
    ([k, v], i) =>
      `<tr><td style="padding:10px 14px;color:#77736a;width:42%;${i ? "border-top:1px solid #e6e1d6;" : ""}">${escapeHtml(k)}</td><td style="padding:10px 14px;font-weight:bold;${i ? "border-top:1px solid #e6e1d6;" : ""}">${escapeHtml(v)}</td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;">${escapeHtml(note)}</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;">Need to reschedule or have a question? Reply to this email or
<a href="${whatsappUrl(`Hello ${brand.name}, regarding my appointment ${a.booking_reference}`)}" style="color:#4f6b3a;font-weight:bold;">message us on WhatsApp</a> (${escapeHtml(WHATSAPP_DISPLAY)}).</p>
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;">We look forward to seeing you.<br><br>Warm regards,<br><strong>The ${escapeHtml(brand.name)} Team</strong></p>
</td></tr>
<tr><td style="padding:16px 28px;background:#f4f1ea;font-size:12px;color:#77736a;">${escapeHtml(brand.tagline)}</td></tr>
</table></td></tr></table></body></html>`;

  return {
    type: "APPOINTMENT_CONFIRMED",
    to: a.email,
    subject: `Appointment Confirmed: ${formatLongDate(a.appointment_date)} at ${formatTime12h(a.appointment_time)} | ${brand.name}`,
    text,
    html,
  };
}

export function buildCancellation(a: AppointmentRecord, settings: Settings): EmailMessage {
  return {
    type: "APPOINTMENT_CANCELLED",
    to: a.email,
    subject: `Cancelled: Your ${brand.name} Consultation (${a.booking_reference})`,
    text: `
Dear ${a.full_name},

Your consultation on ${a.appointment_date} at ${a.appointment_time} (${a.timezone}) has been cancelled.

Booking Reference: ${a.booking_reference}

If this was unexpected, or you would like to book a new time, visit our website or message us on WhatsApp: ${whatsappLink(settings)}

Warm regards,
${brand.name} Coaching Team
`.trim(),
  };
}

export function generateWhatsAppUrl(appointment: AppointmentRecord): string {
  const message = [
    `Hello ${brand.name},`,
    `I have submitted an appointment request. Here are my details:`,
    `• Reference: ${appointment.booking_reference}`,
    `• Name: ${appointment.full_name}`,
    `• Service: ${appointment.service}`,
    `• Preferred Date: ${appointment.appointment_date}`,
    `• Time: ${appointment.appointment_time} (${appointment.timezone})`,
    `• Type: ${appointment.appointment_type}`,
    `• Goal: ${appointment.fitness_goal}`,
    `Looking forward to confirming my consultation. Thank you!`,
  ].join("\n");

  return whatsappUrl(message);
}

// Turns what a customer typed ("98765 43210", "098765 43210", "+91 98765-43210")
// into WhatsApp's international format ("919876543210"). Returns null if unusable.
export function toWhatsAppDigits(raw: string | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // 00 91 ... international prefix
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1); // 0 + 10-digit Indian mobile
  if (digits.length === 10) digits = `91${digits}`; // assume India when no country code
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

// WhatsApp supports *bold*; keep it short, warm and professional.
export function buildCustomerWhatsAppConfirmation(
  a: AppointmentRecord,
  settings: Pick<BookingSettings, "businessLocation">,
): string {
  const { firstName, rows, note } = confirmationDetails(a, settings);
  return [
    `Dear ${firstName},`,
    "",
    `Thank you for choosing *${brand.name}*. Your appointment is *confirmed* ✅`,
    "",
    "*Appointment details*",
    ...rows.map(([k, v]) => `• ${k}: ${v}`),
    "",
    note,
    "",
    "Need to reschedule? Simply reply to this message.",
    "",
    "We look forward to seeing you.",
    `Warm regards,\nThe ${brand.name} Team`,
  ].join("\n");
}

// wa.me link that opens a chat with the CUSTOMER, message pre-written; the admin taps Send.
export function customerWhatsAppConfirmationUrl(
  a: AppointmentRecord,
  settings: Pick<BookingSettings, "businessLocation">,
): string | null {
  const digits = toWhatsAppDigits(a.whatsapp_number) ?? toWhatsAppDigits(a.phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildCustomerWhatsAppConfirmation(a, settings))}`;
}
