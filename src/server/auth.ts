// Admin authentication, entirely on the server.
// - The password is never stored: only a scrypt hash in ADMIN_PASSWORD_HASH
//   (create one with `npm run hash-password`).
// - A successful login sets a signed, HttpOnly, Secure, SameSite=Strict cookie
//   that browser JavaScript cannot read. It expires after SESSION_HOURS.
// - Changing the password (or SESSION_SECRET) signs everyone out.
// - Repeated wrong passwords from one IP are locked out for a while.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { authConfig } from "./env";

export const SESSION_COOKIE = "wpw_admin_session";
export const SESSION_HOURS = 8;

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN);
  return timingSafeEqual(actual, expected);
}

function sign(payload: string, secret: string, passwordHash: string): string {
  return createHmac("sha256", `${secret}|${passwordHash}`).update(payload).digest("base64url");
}

export function createSessionToken(now = Date.now()): string | null {
  const config = authConfig();
  if (!config) return null;
  const payload = `${now + SESSION_HOURS * 3600_000}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(payload, config.sessionSecret, config.passwordHash)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  const config = authConfig();
  if (!config || !token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return false;
  const payload = token.slice(0, lastDot);
  const signature = Buffer.from(token.slice(lastDot + 1));
  const expected = Buffer.from(sign(payload, config.sessionSecret, config.passwordHash));
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return false;
  const expires = Number(payload.split(".")[0]);
  return Number.isFinite(expires) && expires > now;
}

// ---------- simple in-memory rate limiting (single server process) ----------

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
