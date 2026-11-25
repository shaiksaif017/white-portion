// Database-backed rate limiting for security-critical actions (sign-in, codes,
// password resets, bookings). Unlike the in-memory limiter it survives restarts and
// works across server processes, and it is keyed by things an attacker can't fake
// cheaply (an email address or account), not only by IP address.
// Keys are stored as SHA-256 hashes, so the table holds no email addresses.
import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";

import { getDb } from "./db";

const hashKey = (key: string) => createHash("sha256").update(`wpw-throttle|${key}`).digest("hex");

// Counts one attempt in a fixed window and says whether it's still within the limit.
// Fails open (returns true) only if the database is unreachable, so an outage
// doesn't lock everyone out; the per-account lockouts still apply.
export async function throttle(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const db = await getDb();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSeconds);
    const bucket = hashKey(key);
    // SET runs left to right: hits is decided before window_start moves on.
    await db.query(
      `INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE hits = IF(window_start = VALUES(window_start), hits + 1, 1),
                               window_start = VALUES(window_start)`,
      [bucket, windowStart],
    );
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT hits FROM rate_limits WHERE bucket = ?",
      [bucket],
    );
    if (Math.random() < 0.01) {
      // occasional clean-up of old windows
      await db.query("DELETE FROM rate_limits WHERE window_start < ?", [now - 2 * 86_400]);
    }
    return Number(rows[0]?.["hits"] ?? 0) <= max;
  } catch (error) {
    console.error("[throttle] unavailable", error);
    return true;
  }
}
