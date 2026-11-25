// Audit log: who did what and when. Callers pass only safe summaries; this module also
// strips anything that looks like a secret before storing it.
//
// Tamper evidence: every entry carries chain_hash = HMAC(key, previous hash + entry).
// The key comes from SESSION_SECRET, which is not in the database, so someone who
// edits or deletes rows directly in the database can't produce matching hashes, and
// verifyAuditChain() points at the first entry that no longer fits.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { getRequestIP } from "@tanstack/react-start/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { AuditEntry } from "@/lib/admin-types";
import { brand } from "@/lib/brand";
import { getDb } from "./db";
import { authConfig } from "./env";
import { sendEmail } from "./mailer";
import { csvCell } from "./csv";

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

function chainKey(): Buffer | null {
  const config = authConfig();
  return config
    ? createHash("sha256").update(`wpw-audit-chain|${config.sessionSecret}`).digest()
    : null;
}

// The fields that are sealed, in a fixed order, read back exactly as stored.
const SEALED_SELECT =
  "SELECT id, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS ts, actor_id, actor_email, action, target, details, ip, severity, chain_hash FROM audit_log";

function seal(key: Buffer, prev: string, r: RowDataPacket): string {
  const fields = [
    r["id"],
    r["ts"],
    r["actor_id"] ?? "",
    r["actor_email"],
    r["action"],
    r["target"],
    r["details"] ?? "",
    r["ip"],
    r["severity"],
  ].map((v) => String(v));
  return createHmac("sha256", key)
    .update(`${prev}${fields.join("")}`)
    .digest("hex");
}

export async function audit(
  actor: Actor | null,
  action: string,
  target = "",
  details?: Record<string, unknown>,
  severity: Severity = "info",
): Promise<void> {
  let conn: PoolConnection | null = null;
  try {
    const db = await getDb();
    const key = chainKey();
    conn = await db.getConnection();
    await conn.beginTransaction();
    // one writer at a time, so the chain stays in order
    if (key) {
      await conn.query("INSERT IGNORE INTO audit_chain (id, head) VALUES (1, '')");
    }
    const [head] = key
      ? await conn.query<RowDataPacket[]>("SELECT head FROM audit_chain WHERE id = 1 FOR UPDATE")
      : [[] as RowDataPacket[]];
    const [ins] = await conn.query<ResultSetHeader>(
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
    if (key) {
      const [rows] = await conn.query<RowDataPacket[]>(`${SEALED_SELECT} WHERE id = ?`, [
        ins.insertId,
      ]);
      const hash = seal(key, String(head[0]?.["head"] ?? ""), rows[0]!);
      await conn.query("UPDATE audit_log SET chain_hash = ? WHERE id = ?", [hash, ins.insertId]);
      await conn.query("UPDATE audit_chain SET head = ? WHERE id = 1", [hash]);
    }
    await conn.commit();
  } catch (error) {
    // Logging must never break the action itself.
    await conn?.rollback().catch(() => undefined);
    console.error("[audit] could not write", action, error);
  } finally {
    conn?.release();
  }
}

export interface AuditCheck {
  ok: boolean;
  checked: number; // sealed entries verified
  unsealed: number; // older entries written before sealing existed
  firstBadId: number | null; // first entry that was changed, or follows a deleted one
  headOk: boolean; // the newest entry matches the stored chain head (no entries cut off the end)
}

// Re-computes the whole chain. Any edited, inserted or deleted entry breaks it.
export async function verifyAuditChain(): Promise<AuditCheck> {
  const key = chainKey();
  const db = await getDb();
  // entries without a seal are only expected from before sealing started
  const [[counts]] = await db.query<RowDataPacket[]>(
    `SELECT SUM(chain_hash IS NULL) AS unsealed,
       (SELECT MIN(id) FROM audit_log a WHERE a.chain_hash IS NULL
          AND a.id > (SELECT MIN(id) FROM audit_log b WHERE b.chain_hash IS NOT NULL)) AS stray
     FROM audit_log`,
  );
  const unsealed = Number(counts?.["unsealed"] ?? 0);
  const stray = counts?.["stray"] == null ? null : Number(counts["stray"]);
  if (!key) return { ok: false, checked: 0, unsealed, firstBadId: null, headOk: false };
  let prev = "";
  let checked = 0;
  let firstBadId: number | null = stray;
  let lastId = 0;
  for (;;) {
    const [rows] = await db.query<RowDataPacket[]>(
      `${SEALED_SELECT} WHERE id > ? AND chain_hash IS NOT NULL ORDER BY id LIMIT 2000`,
      [lastId],
    );
    if (!rows.length) break;
    for (const r of rows) {
      const stored = Buffer.from(String(r["chain_hash"]));
      const expected = Buffer.from(seal(key, prev, r));
      if (!(stored.length === expected.length && timingSafeEqual(stored, expected))) {
        firstBadId = Math.min(firstBadId ?? Infinity, Number(r["id"]));
      }
      prev = String(r["chain_hash"]);
      lastId = Number(r["id"]);
      checked++;
    }
  }
  const [head] = await db.query<RowDataPacket[]>("SELECT head FROM audit_chain WHERE id = 1");
  const headOk = String(head[0]?.["head"] ?? "") === prev;
  return { ok: firstBadId === null && headOk, checked, unsealed, firstBadId, headOk };
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
  const esc = csvCell;
  return [
    "Time (UTC),Who,Action,Target,Details,IP,Severity",
    ...rows.map((r) =>
      [r.createdAt, r.actorEmail, r.action, r.target, r.details, r.ip, r.severity]
        .map(esc)
        .join(","),
    ),
  ].join("\n");
}
