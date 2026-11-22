import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { smtpSummary, type ResolvedSmtp } from "@/server/mailer";
import { decryptSecret, encryptSecret } from "@/server/secrets";

const base: Omit<ResolvedSmtp, "pass"> = {
  host: "smtp.hostinger.com",
  port: 465,
  user: "care@example.com",
  from: "care@example.com",
  passwordSource: "admin portal",
};

describe("smtpSummary diagnostics", () => {
  it("describes a clean password without revealing it", () => {
    const s = smtpSummary({ ...base, pass: "Good-Pass_123" })!;
    expect(s.passwordLength).toBe(13);
    expect(s.passwordWarnings).toEqual([]);
    expect(s.passwordSource).toBe("admin portal");
    expect(JSON.stringify(s)).not.toContain("Good-Pass_123");
    expect(Date.parse(s.serverStartedAt)).toBeLessThanOrEqual(Date.now());
  });

  it("flags quotes, brackets, inner spaces and HTML codes", () => {
    const w = (pass: string) => smtpSummary({ ...base, pass })!.passwordWarnings.join();
    expect(w('"abc123"')).toContain("quote");
    expect(w("<abc123>")).toContain("brackets");
    expect(w("abc 123")).toContain("space");
    expect(w("a&amp;b")).toContain("HTML");
  });

  it("returns null when mail is not configured", () => {
    expect(smtpSummary(null)).toBeNull();
  });
});

describe("encrypted secrets", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env["ADMIN_PASSWORD_HASH"] = "scrypt:00:00";
    process.env["SESSION_SECRET"] = "s".repeat(64);
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("round-trips and does not store the plain password", () => {
    const enc = encryptSecret("Mailbox-Pass_42");
    expect(enc).not.toContain("Mailbox-Pass_42");
    expect(decryptSecret(enc)).toBe("Mailbox-Pass_42");
    expect(encryptSecret("Mailbox-Pass_42")).not.toBe(enc); // random IV each time
  });

  it("refuses tampered values or a different SESSION_SECRET", () => {
    const enc = encryptSecret("Mailbox-Pass_42");
    expect(decryptSecret(`${enc.slice(0, -2)}00`)).toBeNull();
    process.env["SESSION_SECRET"] = "t".repeat(64);
    expect(decryptSecret(enc)).toBeNull();
  });
});
