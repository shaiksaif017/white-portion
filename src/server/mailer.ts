// Sends email through your Hostinger mailbox (SMTP) and records every attempt in
// the notification_log table. Email failures never break a booking.
import nodemailer, { type Transporter } from "nodemailer";

import { brand } from "@/lib/brand";
import type { EmailMessage } from "@/lib/notifications";
import { logNotification } from "./bookings";
import { smtpBaseConfig } from "./env";
import { getSecret, setSecret } from "./secrets";

const SMTP_SECRET = "smtp_password";

export interface ResolvedSmtp {
  host: string;
  port: number;
  user: string;
  from: string;
  pass: string;
  passwordSource: "admin portal" | "hosting environment variable";
}

// Password set in the admin portal wins over the SMTP_PASS environment variable.
export async function resolveSmtp(): Promise<ResolvedSmtp | null> {
  const base = smtpBaseConfig();
  if (!base) return null;
  let stored: string | null = null;
  try {
    stored = await getSecret(SMTP_SECRET);
  } catch (e) {
    console.error("[mailer] could not read stored email password", e);
  }
  const pass = stored ?? base.envPass;
  if (!pass) return null;
  return {
    host: base.host,
    port: base.port,
    user: base.user,
    from: base.from,
    pass,
    passwordSource: stored ? "admin portal" : "hosting environment variable",
  };
}

export async function saveSmtpPassword(password: string): Promise<void> {
  await setSecret(SMTP_SECRET, password);
}

let transporter: Transporter | undefined;
let transporterKey = "";

async function getTransporter(): Promise<{ transporter: Transporter; from: string } | null> {
  const config = await resolveSmtp();
  if (!config) return null;
  const key = `${config.host}|${config.port}|${config.user}|${config.pass}`;
  if (!transporter || key !== transporterKey) {
    transporterKey = key;
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

// opts.logText replaces the body in the notification log (e.g. to hide login codes).
export async function sendEmail(
  message: EmailMessage,
  replyTo?: string,
  opts: { logText?: string } = {},
): Promise<SendResult> {
  let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
  let error: string | undefined;

  const mail = await getTransporter();
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
      content: opts.logText ?? message.text,
      status,
      error,
    });
  } catch (e) {
    console.error("[mailer] could not write notification log", e);
  }
  return { status, error };
}

// Safe summary of the mail settings the server actually loaded (no password).
export function smtpSummary(config: ResolvedSmtp | null) {
  if (!config) return null;
  return {
    passwordSource: config.passwordSource,
    host: config.host,
    port: config.port,
    user: config.user,
    from: config.from,
    // Diagnostics only: describes the stored password without revealing it.
    passwordLength: config.pass.length,
    passwordWarnings: passwordWarnings(config.pass),
    serverStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
  };
}

function passwordWarnings(pass: string): string[] {
  const warnings: string[] = [];
  if (/^["'`]|["'`]$/.test(pass))
    warnings.push("starts or ends with a quote mark (remove the quotes)");
  if (/\s/.test(pass)) warnings.push("contains a space or line break");
  if (/&(amp|lt|gt|quot|#\d+);/.test(pass)) warnings.push("contains an HTML code like &amp;");
  if (/[^\x20-\x7e]/.test(pass)) warnings.push("contains a non-standard or invisible character");
  if (/^<.*>$/.test(pass)) warnings.push("is wrapped in < > brackets (remove them)");
  return warnings;
}

export async function sendEmails(messages: { message: EmailMessage; replyTo?: string }[]) {
  await Promise.all(messages.map(({ message, replyTo }) => sendEmail(message, replyTo)));
}
