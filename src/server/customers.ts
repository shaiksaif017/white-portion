// Customer accounts with passwordless login: a 6-digit code is emailed, and a signed
// session cookie is set when it's entered. Codes are stored only as keyed hashes,
// expire after 10 minutes and allow 5 tries. "Log out everywhere" bumps
// session_version, which invalidates every existing session cookie at once.
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getCookie } from "@tanstack/react-start/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { CustomerView } from "@/lib/course-types";
import { getDb } from "./db";
import { authConfig } from "./env";

export const CUSTOMER_COOKIE = "wpw_customer";
export const CUSTOMER_SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function key(purpose: string): Buffer | null {
  const config = authConfig();
  if (!config) return null;
  return createHash("sha256").update(`wpw-customer-${purpose}|${config.sessionSecret}`).digest();
}

export function accountsAvailable(): boolean {
  return key("session") !== null;
}

function codeHash(email: string, code: string): string {
  const k = key("code");
  if (!k) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", k).update(`${email}|${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Creates a new code (older unused codes for the email stop working).
export async function createLoginCode(email: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const db = await getDb();
  await db.query("UPDATE customer_login_codes SET used = 1 WHERE email = ? AND used = 0", [email]);
  await db.query(
    "INSERT INTO customer_login_codes (email, code_hash, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)",
    [email, codeHash(email, code), CODE_MINUTES],
  );
  // housekeeping: old codes are useless
  await db.query(
    "DELETE FROM customer_login_codes WHERE created_at < UTC_TIMESTAMP() - INTERVAL 2 DAY",
  );
  return code;
}

export type VerifyResult =
  { ok: true; customerId: number; sessionVersion: number } | { ok: false; error: string };

export async function verifyLoginCode(email: string, code: string): Promise<VerifyResult> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, code_hash, attempts FROM customer_login_codes
     WHERE email = ? AND used = 0 AND expires_at > UTC_TIMESTAMP()
     ORDER BY id DESC LIMIT 1`,
    [email],
  );
  const row = rows[0];
  const expired = { ok: false as const, error: "That code has expired. Please request a new one." };
  if (!row) return expired;
  if (Number(row["attempts"]) >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many wrong codes. Please request a new one." };
  }
  if (!safeEqual(String(row["code_hash"]), codeHash(email, code))) {
    await db.query("UPDATE customer_login_codes SET attempts = attempts + 1 WHERE id = ?", [
      row["id"],
    ]);
    return { ok: false, error: "That code isn't right. Please check the email and try again." };
  }
  // single use: only the request that flips used 0 -> 1 succeeds
  const [res] = await db.query<ResultSetHeader>(
    "UPDATE customer_login_codes SET used = 1 WHERE id = ? AND used = 0",
    [row["id"]],
  );
  if (res.affectedRows !== 1) return expired;

  await db.query(
    `INSERT INTO customers (email, last_login_at) VALUES (?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE last_login_at = UTC_TIMESTAMP()`,
    [email],
  );
  const [c] = await db.query<RowDataPacket[]>(
    "SELECT id, session_version FROM customers WHERE email = ?",
    [email],
  );
  // Fill in name/phone from their most recent order, if the profile is empty.
  await db.query(
    `UPDATE customers c JOIN (SELECT name, phone FROM orders WHERE email = ? ORDER BY id DESC LIMIT 1) o
     SET c.name = IF(c.name = '', o.name, c.name), c.phone = IF(c.phone = '', o.phone, c.phone)
     WHERE c.email = ?`,
    [email, email],
  );
  return {
    ok: true,
    customerId: Number(c[0]?.["id"]),
    sessionVersion: Number(c[0]?.["session_version"]),
  };
}

// ---------- session cookie: "<id>.<version>.<expiresMs>.<signature>" ----------

export function createCustomerToken(customerId: number, version: number, now = Date.now()): string {
  const k = key("session");
  if (!k) throw new Error("SESSION_SECRET is not configured");
  const payload = `${customerId}.${version}.${now + CUSTOMER_SESSION_DAYS * 86_400_000}`;
  return `${payload}.${createHmac("sha256", k).update(payload).digest("base64url")}`;
}

function parseToken(token: string | undefined, now = Date.now()) {
  const k = key("session");
  if (!k || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const payload = parts.slice(0, 3).join(".");
  const expected = createHmac("sha256", k).update(payload).digest("base64url");
  if (!safeEqual(parts[3]!, expected)) return null;
  const [id, version, expires] = parts.slice(0, 3).map(Number);
  if (!id || !version || !expires || expires <= now) return null;
  return { id, version };
}

export interface SessionCustomer extends CustomerView {
  id: number;
}

export async function customerFromToken(
  token: string | undefined,
): Promise<SessionCustomer | null> {
  const t = parseToken(token);
  if (!t) return null;
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, email, name, phone, session_version FROM customers WHERE id = ?",
    [t.id],
  );
  const r = rows[0];
  if (!r || Number(r["session_version"]) !== t.version) return null;
  return {
    id: Number(r["id"]),
    email: String(r["email"]),
    name: String(r["name"]),
    phone: String(r["phone"]),
  };
}

// The logged-in customer for the current request, or null.
export async function customerFromRequest(): Promise<SessionCustomer | null> {
  if (!accountsAvailable()) return null;
  try {
    return await customerFromToken(getCookie(CUSTOMER_COOKIE));
  } catch (error) {
    console.error("[account] session check failed", error);
    return null;
  }
}

export async function updateProfile(id: number, name: string, phone: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE customers SET name = ?, phone = ? WHERE id = ?", [name, phone, id]);
}

export async function logoutEverywhere(id: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE customers SET session_version = session_version + 1 WHERE id = ?", [id]);
}

// ---------- what a logged-in customer may see ----------

export interface AccountOrder {
  orderNumber: string;
  accessToken: string;
  createdAt: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  totalPaise: number;
  itemCount: number;
  summary: string;
}

// Orders placed with this email address (login proves the customer owns it).
export async function listCustomerOrders(email: string): Promise<AccountOrder[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT o.order_number, o.access_token, o.created_at, o.payment_status, o.fulfilment_status, o.total_paise,
            COALESCE(SUM(i.qty), 0) AS item_count,
            GROUP_CONCAT(i.name ORDER BY i.id SEPARATOR ', ') AS summary
     FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.email = ? AND o.payment_status IN ('paid', 'refunded')
     GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`,
    [email],
  );
  return rows.map((r) => ({
    orderNumber: String(r["order_number"]),
    accessToken: String(r["access_token"]),
    createdAt: `${String(r["created_at"]).replace(" ", "T")}Z`,
    paymentStatus: String(r["payment_status"]),
    fulfilmentStatus: String(r["fulfilment_status"]),
    totalPaise: Number(r["total_paise"]),
    itemCount: Number(r["item_count"]),
    summary: String(r["summary"] ?? ""),
  }));
}

export interface AccountDownload {
  orderNumber: string;
  accessToken: string;
  itemId: number;
  name: string;
  purchasedAt: string;
}

export async function listCustomerDownloads(email: string): Promise<AccountDownload[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT o.order_number, o.access_token, o.paid_at, i.id AS item_id, i.name
     FROM orders o JOIN order_items i ON i.order_id = o.id
     WHERE o.email = ? AND o.payment_status = 'paid' AND i.digital_file_id IS NOT NULL
     ORDER BY o.paid_at DESC, i.id`,
    [email],
  );
  return rows.map((r) => ({
    orderNumber: String(r["order_number"]),
    accessToken: String(r["access_token"]),
    itemId: Number(r["item_id"]),
    name: String(r["name"]),
    purchasedAt: `${String(r["paid_at"]).replace(" ", "T")}Z`,
  }));
}
