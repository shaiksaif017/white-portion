import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createSessionToken,
  hashPassword,
  rateLimit,
  verifyPassword,
  verifySessionToken,
} from "@/server/auth";

describe("password hashing", () => {
  it("verifies the right password and rejects others", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(stored.startsWith("scrypt:")).toBe(true);
    expect(stored).not.toContain("correct horse");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
    expect(verifyPassword("anything", "garbage")).toBe(false);
  });
});

describe("session tokens", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env["ADMIN_PASSWORD_HASH"] = hashPassword("pw-one");
    process.env["SESSION_SECRET"] = "a".repeat(40);
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("accepts a fresh token and rejects tampered or expired ones", () => {
    const now = Date.now();
    const token = createSessionToken(now);
    expect(token).toBeTruthy();
    expect(verifySessionToken(token!, now)).toBe(true);
    expect(verifySessionToken(`${token}x`, now)).toBe(false);
    expect(verifySessionToken(token!.replace(/^\d+/, "9999999999999"), now)).toBe(false);
    expect(verifySessionToken(token!, now + 9 * 3600_000)).toBe(false); // after 8 hours
    expect(verifySessionToken(undefined, now)).toBe(false);
  });

  it("signs everyone out when the password changes", () => {
    const token = createSessionToken();
    process.env["ADMIN_PASSWORD_HASH"] = hashPassword("pw-two");
    expect(verifySessionToken(token!)).toBe(false);
  });

  it("refuses to work without configuration", () => {
    delete process.env["SESSION_SECRET"];
    expect(createSessionToken()).toBeNull();
  });
});

describe("rateLimit", () => {
  it("allows up to the limit, then blocks until the window resets", () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimit("k", 5, 1000, t)).toBe(true);
    expect(rateLimit("k", 5, 1000, t)).toBe(false);
    expect(rateLimit("k", 5, 1000, t + 1001)).toBe(true);
  });
});
