// Email templates and WhatsApp links. Pure functions: sending happens on the server
// (src/server/mailer.ts), never in the browser.
import { type AppointmentRecord, type BookingSettings } from "./booking-types";
import { brand } from "./brand";

export type NotificationType =
  "CUSTOMER_ACKNOWLEDGEMENT" | "ADMIN_ALERT" | "APPOINTMENT_CONFIRMED" | "APPOINTMENT_CANCELLED";

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
}

type Settings = Pick<
  BookingSettings,
  "businessLocation" | "businessWhatsapp" | "adminNotificationEmail"
>;

function whatsappLink(settings: Pick<BookingSettings, "businessWhatsapp">): string {
  return `https://wa.me/${settings.businessWhatsapp.replace(/[^0-9]/g, "")}`;
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

export function buildConfirmation(a: AppointmentRecord, settings: Settings): EmailMessage {
  return {
    type: "APPOINTMENT_CONFIRMED",
    to: a.email,
    subject: `CONFIRMED: Your ${brand.name} Consultation (${a.booking_reference})`,
    text: `
Dear ${a.full_name},

Your consultation with ${brand.name} has been CONFIRMED.

--- CONFIRMED APPOINTMENT DETAILS ---
Booking Reference: ${a.booking_reference}
Service: ${a.service}
Date: ${a.appointment_date}
Time: ${a.appointment_time} (${a.timezone})
Format: ${a.appointment_type}

${
  a.appointment_type === "In-Person Consultation"
    ? `Studio Address:\n${settings.businessLocation}\n(Please arrive 5 minutes before your scheduled time.)`
    : "Online Meeting Access:\nYour private video link will be shared with you before your session."
}

Need to change or cancel? Message us on WhatsApp: ${whatsappLink(settings)}

Warm regards,
${brand.name} Coaching Team
`.trim(),
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

export function generateWhatsAppUrl(
  appointment: AppointmentRecord,
  settings: Pick<BookingSettings, "businessWhatsapp">,
): string {
  const cleanPhone = settings.businessWhatsapp.replace(/[^0-9]/g, "");
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

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
