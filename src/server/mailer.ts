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

export interface SendResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string | undefined;
}

// Turns a mail error into a short, human-readable reason (never includes the password).
function describeError(e: unknown): string {
  const err = e as { message?: string; code?: string; responseCode?: number; command?: string };
  const parts = [err.message ?? String(e)];
  if (err.code) parts.push(`code ${err.code}`);
  if (err.responseCode) parts.push(`server reply ${err.responseCode}`);
  return parts.join(" | ");
}

export async function sendEmail(message: EmailMessage, replyTo?: string): Promise<SendResult> {
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
      error = describeError(e);
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
  return { status, error };
}

// Safe summary of the mail settings the server actually loaded (no password).
export function smtpSummary() {
  const config = smtpConfig();
  if (!config) return null;
  return { host: config.host, port: config.port, user: config.user, from: config.from };
}

export async function sendEmails(messages: { message: EmailMessage; replyTo?: string }[]) {
  await Promise.all(messages.map(({ message, replyTo }) => sendEmail(message, replyTo)));
}
