// Audit log: who did what and when. Callers pass only safe summaries; this module also
// strips anything that looks like a secret before storing it.
import { getRequestIP } from "@tanstack/react-start/server";
import type { RowDataPacket } from "mysql2/promise";

import type { AuditEntry } from "@/lib/admin-types";
import { brand } from "@/lib/brand";
import { getDb } from "./db";
import { sendEmail } from "./mailer";

export interface Actor {
  id: number | null;
  email: string;
}

export type Severity = "info" | "warning" | "alert";

const SECRET_KEYS = /password|^pass$|secret|token|^code$|otp|cvv|cardnumber|recovery/i;

// Removes secret-looking fields and keeps the record small.
export function sanitizeDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return "";
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (SECRET_KEYS.test(k)) continue;
    if (v === undefined) continue;
    clean[k] = typeof v === "string" ? v.slice(0, 300) : v;
  }
  const json = JSON.stringify(clean);
  return json === "{}" ? "" : json.slice(0, 4000);
}

function requestIp(): string {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? "";
  } catch {
    return ""; // not inside a request (tests, scripts)
  }
}

export async function audit(
  actor: Actor | null,
  action: string,
  target = "",
  details?: Record<string, unknown>,
  severity: Severity = "info",
): Promise<void> {
  try {
    const db = await getDb();
    await db.query(
      "INSERT INTO audit_log (actor_id, actor_email, action, target, details, ip, severity) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        actor?.id ?? null,
        (actor?.email ?? "").slice(0, 254),
        action.slice(0, 60),
        target.slice(0, 200),
        sanitizeDetails(details),
        requestIp().slice(0, 64),
        severity,
      ],
    );
  } catch (error) {
    // Logging must never break the action itself.
    console.error("[audit] could not write", action, error);
  }
}

// Emails every active owner about a security-relevant event (best effort).
export async function securityAlert(subject: string, lines: string[]): Promise<void> {
  try {
    const db = await getDb();
    const [owners] = await db.query<RowDataPacket[]>(
      "SELECT email FROM admin_users WHERE role = 'owner' AND active = 1",
    );
    const ip = requestIp();
    await Promise.all(
      owners.map((o) =>
        sendEmail({
          type: "ADMIN_SECURITY",
          to: String(o["email"]),
          subject: `[Security] ${subject} | ${brand.name}`,
          text: [
            ...lines,
            "",
            `Time: ${new Date().toISOString()}`,
            ...(ip ? [`From IP address: ${ip}`] : []),
            "",
            "If this wasn't expected, open Admin → Security to review the audit log, sign the person out or reset their access.",
          ].join("\n"),
        }),
      ),
    );
  } catch (error) {
    console.error("[audit] security alert failed", error);
  }
}

export async function listAudit(opts: {
  q?: string | undefined;
  severity?: "warning" | "alert" | undefined;
  limit?: number;
}): Promise<AuditEntry[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    const like = `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(
      "(actor_email LIKE ? OR action LIKE ? OR target LIKE ? OR details LIKE ? OR ip LIKE ?)",
    );
    params.push(like, like, like, like, like);
  }
  if (opts.severity === "warning") where.push("severity IN ('warning', 'alert')");
  if (opts.severity === "alert") where.push("severity = 'alert'");
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`,
    [...params, opts.limit ?? 500],
  );
  return rows.map((r) => ({
    id: Number(r["id"]),
    createdAt: `${String(r["created_at"]).replace(" ", "T")}Z`,
    actorEmail: String(r["actor_email"]),
    action: String(r["action"]),
    target: String(r["target"]),
    details: String(r["details"] ?? ""),
    ip: String(r["ip"]),
    severity: String(r["severity"]) as AuditEntry["severity"],
  }));
}

export function auditToCsv(rows: AuditEntry[]): string {
  const esc = (v: string) => {
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [
    "Time (UTC),Who,Action,Target,Details,IP,Severity",
    ...rows.map((r) =>
      [r.createdAt, r.actorEmail, r.action, r.target, r.details, r.ip, r.severity]
        .map(esc)
        .join(","),
    ),
  ].join("\n");
}
