// Admin accounts: email + password, then a 6-digit code sent by email (recovery codes as
// a backup), lockout after repeated failures, invite / password-reset links and
// "sign out everywhere" via session_version.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { type AdminRole, type AdminUserView, ROLE_PERMISSIONS } from "@/lib/admin-types";
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword } from "./auth";
import { getDb, isDuplicateKeyError } from "./db";
import { authConfig } from "./env";

export const ADMIN_SESSION_HOURS = 8;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: AdminRole;
  sessionVersion: number;
}

function key(purpose: string): Buffer {
  const config = authConfig();
  if (!config) throw new Error("SESSION_SECRET is not configured");
  return createHash("sha256").update(`wpw-admin-${purpose}|${config.sessionSecret}`).digest();
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const sha = (s: string) => createHmac("sha256", key("hash")).update(s).digest("hex");

function toUser(r: RowDataPacket): AdminUser {
  return {
    id: Number(r["id"]),
    email: String(r["email"]),
    name: String(r["name"]),
    role: String(r["role"]) as AdminRole,
    sessionVersion: Number(r["session_version"]),
  };
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM admin_users");
  return Number(rows[0]?.["n"]);
}

export async function getUser(id: number): Promise<AdminUser | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM admin_users WHERE id = ? AND active = 1",
    [id],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

// ---------- session cookie: "<id>.<version>.<mfa 0|1>.<expiresMs>.<sig>" ----------
// id 0 / version 0 is the one-time "bootstrap" session from the old shared password,
// which can only create the first Owner account.

export function createAdminToken(userId: number, version: number, mfa: boolean, now = Date.now()) {
  const payload = `${userId}.${version}.${mfa ? 1 : 0}.${now + ADMIN_SESSION_HOURS * 3_600_000}`;
  return `${payload}.${createHmac("sha256", key("session")).update(payload).digest("base64url")}`;
}

export function parseAdminToken(token: string | undefined, now = Date.now()) {
  if (!token || !authConfig()) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const payload = parts.slice(0, 4).join(".");
  if (
    !safeEqual(parts[4]!, createHmac("sha256", key("session")).update(payload).digest("base64url"))
  )
    return null;
  const [id, version, mfa, expires] = parts.slice(0, 4).map(Number);
  if (!Number.isInteger(id) || !Number.isInteger(version) || !expires || expires <= now)
    return null;
  return { id: id!, version: version!, mfa: mfa === 1 };
}

// Short-lived ticket between the password step and the 2FA step.
export function createMfaTicket(userId: number, now = Date.now()): string {
  const payload = `mfa.${userId}.${now + 5 * 60_000}`;
  return `${payload}.${createHmac("sha256", key("ticket")).update(payload).digest("base64url")}`;
}

export function parseMfaTicket(ticket: string, now = Date.now()): number | null {
  const parts = ticket.split(".");
  if (parts.length !== 4 || parts[0] !== "mfa") return null;
  const payload = parts.slice(0, 3).join(".");
  if (
    !safeEqual(parts[3]!, createHmac("sha256", key("ticket")).update(payload).digest("base64url"))
  )
    return null;
  const id = Number(parts[1]);
  const exp = Number(parts[2]);
  return id > 0 && exp > now ? id : null;
}

// ---------- password step ----------

export type PasswordResult =
  { ok: true; user: AdminUser } | { ok: false; error: string; locked?: boolean; userId?: number };

const BAD_LOGIN = "Incorrect email or password.";

export async function checkPassword(email: string, password: string): Promise<PasswordResult> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT *, (locked_until IS NOT NULL AND locked_until > UTC_TIMESTAMP()) AS is_locked
     FROM admin_users WHERE email = ?`,
    [email],
  );
  const r = rows[0];
  if (!r || !r["active"]) {
    // spend similar time as a real check so timing doesn't reveal which emails exist
    verifyAgainstDummy(password);
    return { ok: false, error: BAD_LOGIN };
  }
  if (Number(r["is_locked"])) {
    return {
      ok: false,
      locked: true,
      userId: Number(r["id"]),
      error: `Too many failed attempts. This account is locked for ${LOCK_MINUTES} minutes; use "Forgot password" to unlock it now.`,
    };
  }
  const stored = String(r["password_hash"]);
  if (!verifyPassword(password, stored)) {
    // atomic increment (parallel guesses can't all read the same old count);
    // SET runs left to right, so locked_until sees the new count
    await db.query(
      `UPDATE admin_users SET failed_attempts = failed_attempts + 1,
         locked_until = IF(failed_attempts >= ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, locked_until) WHERE id = ?`,
      [MAX_FAILS, LOCK_MINUTES, r["id"]],
    );
    const [after] = await db.query<RowDataPacket[]>(
      "SELECT failed_attempts FROM admin_users WHERE id = ?",
      [r["id"]],
    );
    return {
      ok: false,
      error: BAD_LOGIN,
      userId: Number(r["id"]),
      locked: Number(after[0]?.["failed_attempts"]) >= MAX_FAILS,
    };
  }
  if (needsRehash(stored)) {
    // upgrade older hashes to the current, stronger settings
    await db.query("UPDATE admin_users SET password_hash = ? WHERE id = ?", [
      hashPassword(password),
      r["id"],
    ]);
  }
  return { ok: true, user: toUser(r) };
}

export async function recordLogin(userId: number): Promise<void> {
  const db = await getDb();
  await db.query(
    "UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?",
    [userId],
  );
}

// ---------- second step: a code sent by email (recovery codes as a backup) ----------

const LOGIN_CODE_MINUTES = 10;

// Creates a fresh 6-digit sign-in code (older unused codes stop working). Only a keyed
// hash is stored. The caller sends the code; an SMS sender can be plugged in later.
export async function createLoginCode(userId: number): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const db = await getDb();
  // one live code per person: older ones (used or not) are removed
  await db.query("DELETE FROM admin_tokens WHERE user_id = ? AND purpose = 'login'", [userId]);
  await db.query(
    "INSERT INTO admin_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, 'login', ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)",
    [userId, sha(`login|${userId}|${code}`), LOGIN_CODE_MINUTES],
  );
  return code;
}

// Accepts the emailed 6-digit code or an unused recovery code ("abcd-efgh").
export async function checkSecondFactor(
  userId: number,
  code: string,
): Promise<{ ok: true; usedRecovery: boolean } | { ok: false; error: string }> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT failed_attempts, (locked_until IS NOT NULL AND locked_until > UTC_TIMESTAMP()) AS is_locked
     FROM admin_users WHERE id = ? AND active = 1`,
    [userId],
  );
  const r = rows[0];
  if (!r) return { ok: false, error: "Please sign in again." };
  if (Number(r["is_locked"])) {
    return { ok: false, error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` };
  }
  const clean = code.trim().toLowerCase().replace(/\s/g, "");

  if (/^\d{6}$/.test(clean)) {
    // single use: only the request that flips used 0 -> 1 succeeds
    const [res] = await db.query<ResultSetHeader>(
      `UPDATE admin_tokens SET used = 1
       WHERE user_id = ? AND purpose = 'login' AND token_hash = ? AND used = 0 AND expires_at > UTC_TIMESTAMP()`,
      [userId, sha(`login|${userId}|${clean}`)],
    );
    if (res.affectedRows === 1) return { ok: true, usedRecovery: false };
  } else if (/^[a-z0-9]{4}-?[a-z0-9]{4}$/.test(clean)) {
    const hash = sha(`recovery|${userId}|${clean.replace("-", "")}`);
    const [res] = await db.query<ResultSetHeader>(
      "UPDATE admin_recovery_codes SET used = 1 WHERE user_id = ? AND code_hash = ? AND used = 0",
      [userId, hash],
    );
    if (res.affectedRows === 1) return { ok: true, usedRecovery: true };
  }
  // failed_attempts is already incremented when locked_until is worked out (SET runs left to right)
  await db.query(
    `UPDATE admin_users SET failed_attempts = failed_attempts + 1,
       locked_until = IF(failed_attempts >= ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, locked_until) WHERE id = ?`,
    [MAX_FAILS, LOCK_MINUTES, userId],
  );
  return {
    ok: false,
    error: "That code isn't right or has expired. Use the newest code from your email.",
  };
}

function newRecoveryCodes(): string[] {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => {
    const b = randomBytes(8);
    const s = [...b].map((x) => chars[x % chars.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

// Recovery codes are the backup if the email can't be received.
export async function regenerateRecoveryCodes(userId: number): Promise<string[]> {
  const codes = newRecoveryCodes();
  const db = await getDb();
  await db.query("DELETE FROM admin_recovery_codes WHERE user_id = ?", [userId]);
  for (const c of codes) {
    await db.query("INSERT INTO admin_recovery_codes (user_id, code_hash) VALUES (?, ?)", [
      userId,
      sha(`recovery|${userId}|${c.replace("-", "")}`),
    ]);
  }
  return codes;
}

export async function recoveryCodesLeft(userId: number): Promise<number> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM admin_recovery_codes WHERE user_id = ? AND used = 0",
    [userId],
  );
  return Number(rows[0]?.["n"]);
}

// ---------- invite / reset links ----------

export async function createLinkToken(
  userId: number,
  purpose: "invite" | "reset",
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.query(
    "UPDATE admin_tokens SET used = 1 WHERE user_id = ? AND purpose = ? AND used = 0",
    [userId, purpose],
  );
  await db.query(
    "INSERT INTO admin_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)",
    [userId, purpose, sha(`link|${token}`), purpose === "invite" ? 72 * 60 : 30],
  );
  return token;
}

export async function peekLinkToken(token: string) {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT t.purpose, u.email, u.name FROM admin_tokens t JOIN admin_users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.used = 0 AND t.expires_at > UTC_TIMESTAMP() AND u.active = 1`,
    [sha(`link|${token}`)],
  );
  const r = rows[0];
  return r
    ? {
        purpose: String(r["purpose"]) as "invite" | "reset",
        email: String(r["email"]),
        name: String(r["name"]),
      }
    : null;
}

export async function useLinkToken(
  token: string,
  newPassword: string,
): Promise<
  { ok: true; user: AdminUser; purpose: "invite" | "reset" } | { ok: false; error: string }
> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT t.id, t.user_id, t.purpose FROM admin_tokens t JOIN admin_users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.used = 0 AND t.expires_at > UTC_TIMESTAMP() AND u.active = 1`,
    [sha(`link|${token}`)],
  );
  const r = rows[0];
  if (!r)
    return { ok: false, error: "This link has expired or was already used. Ask for a new one." };
  const [res] = await db.query<ResultSetHeader>(
    "UPDATE admin_tokens SET used = 1 WHERE id = ? AND used = 0",
    [r["id"]],
  );
  if (res.affectedRows !== 1) return { ok: false, error: "This link was already used." };
  // a new password signs out every existing session and lifts any lockout
  await db.query(
    `UPDATE admin_users SET password_hash = ?, failed_attempts = 0, locked_until = NULL,
       session_version = session_version + 1 WHERE id = ?`,
    [hashPassword(newPassword), r["user_id"]],
  );
  const user = await getUser(Number(r["user_id"]));
  if (!user) return { ok: false, error: "Account not found." };
  return { ok: true, user, purpose: String(r["purpose"]) as "invite" | "reset" };
}

export async function findActiveByEmail(email: string): Promise<AdminUser | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM admin_users WHERE email = ? AND active = 1",
    [email],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

// ---------- account management ----------

export async function createUser(
  email: string,
  name: string,
  role: AdminRole,
  password?: string,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const db = await getDb();
  try {
    const [res] = await db.query<ResultSetHeader>(
      "INSERT INTO admin_users (email, name, role, password_hash) VALUES (?, ?, ?, ?)",
      // invited users get an unusable random password until they set their own
      [email, name, role, hashPassword(password ?? randomBytes(32).toString("hex"))],
    );
    return { ok: true, id: res.insertId };
  } catch (error) {
    if (isDuplicateKeyError(error))
      return { ok: false, error: "That email already has an admin account." };
    throw error;
  }
}

export async function changePassword(
  userId: number,
  current: string,
  next: string,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT password_hash FROM admin_users WHERE id = ?",
    [userId],
  );
  if (!rows[0] || !verifyPassword(current, String(rows[0]["password_hash"]))) {
    return { ok: false, error: "Your current password isn't right." };
  }
  await db.query(
    "UPDATE admin_users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?",
    [hashPassword(next), userId],
  );
  const u = await getUser(userId);
  return { ok: true, version: u?.sessionVersion ?? 0 };
}

export async function listUsers(): Promise<AdminUserView[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT u.*, EXISTS(SELECT 1 FROM admin_tokens t WHERE t.user_id = u.id AND t.purpose = 'invite'
       AND t.used = 0 AND t.expires_at > UTC_TIMESTAMP()) AS invite_pending
     FROM admin_users u ORDER BY u.active DESC, FIELD(u.role, 'owner', 'manager', 'staff'), u.email`,
  );
  const iso = (v: unknown) => (v ? `${String(v).replace(" ", "T")}Z` : null);
  return rows.map((r) => ({
    id: Number(r["id"]),
    email: String(r["email"]),
    name: String(r["name"]),
    role: String(r["role"]) as AdminRole,
    active: Boolean(r["active"]),
    invitePending: Boolean(Number(r["invite_pending"])),
    lastLoginAt: iso(r["last_login_at"]),
    createdAt: iso(r["created_at"]) ?? "",
  }));
}

async function activeOwnerCount(excludeId: number): Promise<number> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM admin_users WHERE role = 'owner' AND active = 1 AND id <> ?",
    [excludeId],
  );
  return Number(rows[0]?.["n"]);
}

export async function updateUser(
  actorId: number,
  id: number,
  patch: { role: AdminRole; active: boolean; name: string },
): Promise<{ ok: true; before: AdminUserView } | { ok: false; error: string }> {
  const before = (await listUsers()).find((u) => u.id === id);
  if (!before) return { ok: false, error: "Admin not found." };
  if (id === actorId && (!patch.active || patch.role !== before.role)) {
    return { ok: false, error: "You can't change your own role or deactivate yourself." };
  }
  if (
    before.role === "owner" &&
    (patch.role !== "owner" || !patch.active) &&
    (await activeOwnerCount(id)) === 0
  ) {
    return { ok: false, error: "There must always be at least one active Owner." };
  }
  const db = await getDb();
  await db.query(
    // any change of access signs the person out so it takes effect immediately
    // MySQL applies SET left to right, so compare with the OLD role/active before changing them
    `UPDATE admin_users SET session_version = session_version + IF(role <> ? OR active <> ?, 1, 0),
       role = ?, active = ?, name = ? WHERE id = ?`,
    [patch.role, patch.active ? 1 : 0, patch.role, patch.active ? 1 : 0, patch.name, id],
  );
  return { ok: true, before };
}

export async function signOutEverywhere(id: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE admin_users SET session_version = session_version + 1 WHERE id = ?", [id]);
}

export function permissionsFor(role: AdminRole) {
  return ROLE_PERMISSIONS[role];
}
