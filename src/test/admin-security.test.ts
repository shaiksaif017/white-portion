import { beforeAll, describe, expect, it } from "vitest";

import { can, PasswordSchema, ROLE_PERMISSIONS } from "@/lib/admin-types";
import { securityHeaders } from "@/lib/security-headers";
import { sanitizeDetails } from "@/server/audit";

describe("roles", () => {
  it("gives least privilege to staff and managers", () => {
    expect(can("staff", "bookings")).toBe(true);
    expect(can("staff", "orders")).toBe(true);
    for (const p of ["refunds", "products", "settings", "users", "audit", "dashboard"] as const)
      expect(can("staff", p)).toBe(false);
    expect(can("manager", "products")).toBe(true);
    expect(can("manager", "settings")).toBe(false);
    expect(can("manager", "users")).toBe(false);
    expect(ROLE_PERMISSIONS.owner.length).toBe(9);
  });

  it("rejects weak passwords", () => {
    expect(PasswordSchema.safeParse("short").success).toBe(false);
    expect(PasswordSchema.safeParse("aaaaaaaaaaaa").success).toBe(false);
    expect(PasswordSchema.safeParse("correct horse battery").success).toBe(true);
  });
});

describe("audit details", () => {
  it("never stores secrets", () => {
    const out = sanitizeDetails({
      password: "hunter2hunter2",
      keySecret: "abc",
      token: "t",
      code: "123456",
      recoveryCode: "abcd-efgh",
      couponCode: "SAVE10",
      price: 499,
    });
    expect(out).toBe('{"couponCode":"SAVE10","price":499}');
    expect(sanitizeDetails(undefined)).toBe("");
  });
});

describe("security headers", () => {
  it("sends CSP, HSTS and anti-framing on the live domain", () => {
    const h = securityHeaders(new URL("https://officialwhiteportion.com/"));
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
    expect(h["Content-Security-Policy"]).toContain("https://checkout.razorpay.com");
    expect(h["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(h["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Cache-Control"]).toBeUndefined();
  });

  it("marks private pages no-store", () => {
    for (const path of ["/admin", "/account", "/learn/x", "/order/WP-ABC123", "/api/download"])
      expect(
        securityHeaders(new URL(`https://officialwhiteportion.com${path}`))["Cache-Control"],
      ).toBe("private, no-store");
  });

  it("leaves Lovable's editor preview framable", () => {
    const h = securityHeaders(new URL("https://abc.lovable.app/"));
    expect(h["Content-Security-Policy"]).toBeUndefined();
    expect(h["X-Frame-Options"]).toBeUndefined();
  });
});

describe("admin session tokens", () => {
  let users: typeof import("@/server/admin-users");
  beforeAll(async () => {
    process.env["SESSION_SECRET"] = "z".repeat(40);
    process.env["ADMIN_PASSWORD_HASH"] = "scrypt:00:00";
    users = await import("@/server/admin-users");
  });

  it("can't be forged or edited", () => {
    const t = users.createAdminToken(3, 7, true);
    expect(users.parseAdminToken(t)).toEqual({ id: 3, version: 7, mfa: true });
    const [id, v, , exp, sig] = t.split(".");
    // flip "2FA done" from 1 to 0 and back: any edit breaks the signature
    expect(users.parseAdminToken(`${id}.${v}.0.${exp}.${sig}`)).toBeNull();
    expect(users.parseAdminToken(`9.${v}.1.${exp}.${sig}`)).toBeNull();
    expect(
      users.parseAdminToken(users.createAdminToken(3, 7, true, Date.now() - 9 * 3600_000)),
    ).toBeNull();
  });

  it("2FA tickets expire after 5 minutes", () => {
    expect(users.parseMfaTicket(users.createMfaTicket(5))).toBe(5);
    expect(users.parseMfaTicket(users.createMfaTicket(5, Date.now() - 6 * 60_000))).toBeNull();
    expect(users.parseMfaTicket("mfa.5.99999999999999.forged")).toBeNull();
  });
});
