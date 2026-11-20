import { type AppointmentRecord, type BookingSettings } from "./booking-types";
import { brand } from "./brand";

export interface NotificationLog {
  id: string;
  type: "CUSTOMER_ACKNOWLEDGEMENT" | "ADMIN_ALERT" | "APPOINTMENT_CONFIRMED" | "APPOINTMENT_CANCELLED";
  recipient: string;
  subject: string;
  content: string;
  sentAt: string;
  status: "SENT" | "LOGGED";
}

const STORAGE_KEY_NOTIFICATIONS = "wpw_notifications_log_v1";

export function getNotificationLogs(): NotificationLog[] {
  if (typeof window !== "undefined") {
    try {
      const data = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Could not load notifications from localStorage", e);
    }
  }
  return [];
}

export function recordNotification(log: Omit<NotificationLog, "id" | "sentAt">): void {
  const newLog: NotificationLog = {
    ...log,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sentAt: new Date().toISOString(),
  };

  const current = getNotificationLogs();
  const updated = [newLog, ...current];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated.slice(0, 100)));
    } catch (e) {
      console.warn("Could not save notification to localStorage", e);
    }
  }

  // Also log to console in development
  console.log(`[EMAIL DISPATCH] To: ${newLog.recipient} | Subject: ${newLog.subject}`);
}

export function sendBookingAcknowledgement(appointment: AppointmentRecord, settings: BookingSettings): void {
  // 1. Client Acknowledgement Email
  const customerSubject = `Your ${brand.name} Consultation Request (${appointment.booking_reference})`;
  const customerBody = `
Dear ${appointment.full_name},

Thank you for choosing ${brand.name}.

We have received your appointment request. Please note that this consultation request is currently PENDING REVIEW by our coaching team. We will review your goals and verify schedule availability within 24 business hours.

--- REQUEST DETAILS ---
Booking Reference: ${appointment.booking_reference}
Service: ${appointment.service}
Appointment Type: ${appointment.appointment_type}
Requested Date: ${appointment.appointment_date}
Requested Time: ${appointment.appointment_time} (${appointment.timezone})
Fitness Goal: ${appointment.fitness_goal}

${appointment.appointment_type === "In-Person Consultation" 
  ? `Location: ${settings.businessLocation}` 
  : "Location: Private Video Consultation Link will be provided once your appointment is confirmed."}

If you have urgent questions, you may contact our concierge team directly on WhatsApp:
https://wa.me/${settings.businessWhatsapp.replace(/[^0-9]/g, "")}

Warm regards,
Admissions & Coaching Directorate
${brand.name}
${brand.tagline}
  `.trim();

  recordNotification({
    type: "CUSTOMER_ACKNOWLEDGEMENT",
    recipient: appointment.email,
    subject: customerSubject,
    content: customerBody,
    status: "SENT",
  });

  // 2. Admin Notification
  const adminSubject = `[NEW INTAKE] ${appointment.service} - ${appointment.full_name} (${appointment.booking_reference})`;
  const adminBody = `
NEW CONSULTATION REQUEST RECEIVED

Reference: ${appointment.booking_reference}
Client Name: ${appointment.full_name}
Email: ${appointment.email}
Phone: ${appointment.phone}
WhatsApp: ${appointment.whatsapp_number || "Same"}
Service: ${appointment.service}
Date & Time: ${appointment.appointment_date} at ${appointment.appointment_time} (${appointment.timezone})
Type: ${appointment.appointment_type}
Primary Goal: ${appointment.fitness_goal}
Experience: ${appointment.training_experience || "Not provided"}
Current Weight / Height: ${appointment.current_weight || "N/A"} / ${appointment.height || "N/A"}
Dietary Preferences: ${appointment.dietary_preferences || "None specified"}
Additional Notes: ${appointment.additional_information || "None"}
Status: PENDING REVIEW

Please login to the White Portion Wellness Admin Portal to confirm or reschedule this request.
  `.trim();

  recordNotification({
    type: "ADMIN_ALERT",
    recipient: settings.adminNotificationEmail,
    subject: adminSubject,
    content: adminBody,
    status: "SENT",
  });
}

export function sendBookingConfirmation(appointment: AppointmentRecord, settings: BookingSettings): void {
  const subject = `CONFIRMED: Your ${brand.name} Consultation (${appointment.booking_reference})`;
  const body = `
Dear ${appointment.full_name},

We are pleased to inform you that your consultation with ${brand.name} has been CONFIRMED.

--- CONFIRMED APPOINTMENT DETAILS ---
Booking Reference: ${appointment.booking_reference}
Service: ${appointment.service}
Date: ${appointment.appointment_date}
Time: ${appointment.appointment_time} (${appointment.timezone})
Format: ${appointment.appointment_type}

${appointment.appointment_type === "In-Person Consultation"
  ? `Studio Address:\n${settings.businessLocation}\n(Please arrive 5 minutes prior to your scheduled time.)`
  : "Online Meeting Access:\nYour private video conference link has been scheduled and will be emailed 1 hour prior to your session."}

We look forward to partnering with you on your physique and health journey.

Warm regards,
${brand.name} Coaching Team
  `.trim();

  recordNotification({
    type: "APPOINTMENT_CONFIRMED",
    recipient: appointment.email,
    subject: subject,
    content: body,
    status: "SENT",
  });
}

export function generateWhatsAppUrl(appointment: AppointmentRecord, settings: BookingSettings): string {
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
