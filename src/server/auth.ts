// Password hashing, legacy session helpers and rate limiting (server only).
// - Passwords are never stored: only a salted scrypt hash.
// - New hashes use stronger scrypt settings (N=2^16, r=8, p=1, about 64 MB of memory
//   per check), which makes stolen hashes far slower to crack. Older hashes still
//   verify and are upgraded automatically at the next successful sign-in.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { authConfig } from "./env";

export const SESSION_COOKIE = "wpw_admin_session";
export const SESSION_HOURS = 8;

const SCRYPT_KEYLEN = 64;
const LOG_N = 16; // N = 65536
const R = 8;
const P = 1;
const MAXMEM = 160 * 1024 * 1024;

// Format: "scrypt2:<logN>:<r>:<p>:<saltHex>:<hashHex>"
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: 2 ** LOG_N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return `scrypt2:${LOG_N}:${R}:${P}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  try {
    if (parts[0] === "scrypt2" && parts.length === 6) {
      const [, logN, r, p, saltHex, hashHex] = parts;
      const n = Number(logN);
      const rr = Number(r);
      const pp = Number(p);
      // refuse silly parameters from a tampered hash (denial of service)
      if (!(n >= 14 && n <= 20 && rr >= 1 && rr <= 16 && pp >= 1 && pp <= 4)) return false;
      const expected = Buffer.from(hashHex!, "hex");
      if (expected.length !== SCRYPT_KEYLEN) return false;
      const actual = scryptSync(password, Buffer.from(saltHex!, "hex"), SCRYPT_KEYLEN, {
        N: 2 ** n,
        r: rr,
        p: pp,
        maxmem: MAXMEM * 4,
      });
      return timingSafeEqual(actual, expected);
    }
    // legacy "scrypt:<salt>:<hash>" with Node's default settings
    const [scheme, saltHex, hashHex] = parts;
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== SCRYPT_KEYLEN) return false;
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`scrypt2:${LOG_N}:${R}:${P}:`);
}

// A real hash to check against when an account doesn't exist, so the response takes
// the same time either way (no clue which emails have admin accounts).
let dummy: string | null = null;
export function verifyAgainstDummy(password: string): void {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  verifyPassword(password, dummy);
}

// ---------- legacy shared-password session helpers (kept for tests / first-time setup) ----------

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

// ---------- fast in-memory rate limiting (per server process) ----------
// Used as a first, cheap layer. Anything security-critical also uses the
// database-backed throttle() in ./throttle.ts, which survives restarts and
// can't be dodged by faking an IP address.

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
