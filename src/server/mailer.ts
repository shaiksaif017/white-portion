// Sends email through your Hostinger mailbox (SMTP) and records every attempt in
// the notification_log table. Email failures never break a booking.
import nodemailer, { type Transporter } from "nodemailer";

import { brand } from "@/lib/brand";
import type { EmailMessage } from "@/lib/notifications";
import { logNotification } from "./bookings";
import { smtpConfig } from "./env";

let transporter: Transporter | undefined;

function getTransporter(): { transporter: Transporter; from: string } | null {
  const config = smtpConfig();
  if (!config) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return { transporter, from: `"${brand.name}" <${config.from}>` };
}

export async function sendEmail(message: EmailMessage, replyTo?: string): Promise<void> {
  let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
  let error: string | undefined;

  const mail = getTransporter();
  if (mail && message.to) {
    try {
      await mail.transporter.sendMail({
        from: mail.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(replyTo ? { replyTo } : {}),
      });
      status = "SENT";
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message : String(e);
      console.error("[mailer] send failed", message.type, error);
    }
  } else if (!mail) {
    error = "SMTP is not configured on the server";
  }

  try {
    await logNotification({
      type: message.type,
      recipient: message.to,
      subject: message.subject,
      content: message.text,
      status,
      error,
    });
  } catch (e) {
    console.error("[mailer] could not write notification log", e);
  }
}

export async function sendEmails(messages: { message: EmailMessage; replyTo?: string }[]) {
  await Promise.all(messages.map(({ message, replyTo }) => sendEmail(message, replyTo)));
}
