import { afterEach, describe, expect, it } from "vitest";

import { smtpSummary } from "@/server/mailer";

describe("smtpSummary diagnostics", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  function withPass(pass: string) {
    process.env["SMTP_HOST"] = "smtp.hostinger.com";
    process.env["SMTP_USER"] = "care@example.com";
    process.env["SMTP_PASS"] = pass;
    return smtpSummary()!;
  }

  it("describes a clean password without revealing it", () => {
    const s = withPass("Good-Pass_123");
    expect(s.passwordLength).toBe(13);
    expect(s.passwordWarnings).toEqual([]);
    expect(JSON.stringify(s)).not.toContain("Good-Pass_123");
    expect(Date.parse(s.serverStartedAt)).toBeLessThanOrEqual(Date.now());
  });

  it("flags quotes, brackets, inner spaces and HTML codes", () => {
    expect(withPass('"abc123"').passwordWarnings.join()).toContain("quote");
    expect(withPass("<abc123>").passwordWarnings.join()).toContain("brackets");
    expect(withPass("abc 123").passwordWarnings.join()).toContain("space");
    expect(withPass("a&amp;b").passwordWarnings.join()).toContain("HTML");
  });
});
