// Real-database test for admin accounts, emailed sign-in codes, recovery codes, reset links, roles,
// the audit log and the dashboard. Runs only with DB_TEST=1 on a throwaway database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env["DB_TEST"] === "1";

describe.skipIf(!enabled)("admin security against a real database", async () => {
  process.env["SESSION_SECRET"] ??= "w".repeat(40);
  process.env["ADMIN_PASSWORD_HASH"] ??= "scrypt:00:00";
  const users = await import("@/server/admin-users");
  const audit = await import("@/server/audit");
  const { getDashboardStats } = await import("@/server/dashboard");
  const { getDb } = await import("@/server/db");

  let ownerId = 0;
  let staffId = 0;

  beforeAll(async () => {
    const db = await getDb();
    for (const t of ["admin_recovery_codes", "admin_tokens", "admin_users", "audit_log", "audit_chain"])
      await db.query(`DELETE FROM ${t}`);
  });
  afterAll(async () => {
    await (await getDb()).end();
  });

  it("creates accounts and checks passwords", async () => {
    const o = await users.createUser("owner@example.com", "Owner", "owner", "a strong password 1");
    const s = await users.createUser("staff@example.com", "Staff", "staff", "another password 2");
    if (!o.ok || !s.ok) throw new Error("create");
    ownerId = o.id;
    staffId = s.id;
    expect(await users.createUser("OWNER@example.com".toLowerCase(), "X", "staff")).toMatchObject({
      ok: false,
    });
    expect(await users.checkPassword("owner@example.com", "a strong password 1")).toMatchObject({
      ok: true,
    });
    expect(await users.checkPassword("nobody@example.com", "x")).toEqual({
      ok: false,
      error: "Incorrect email or password.",
    });
  });

  it("locks an account after 5 wrong passwords; a reset link unlocks it and signs out sessions", async () => {
    for (let i = 0; i < 5; i++) await users.checkPassword("staff@example.com", "wrong password");
    const locked = await users.checkPassword("staff@example.com", "another password 2");
    expect(locked).toMatchObject({ ok: false, locked: true });

    const before = (await users.getUser(staffId))!.sessionVersion;
    const token = await users.createLinkToken(staffId, "reset");
    expect(await users.peekLinkToken(token)).toMatchObject({
      purpose: "reset",
      email: "staff@example.com",
    });
    const used = await users.useLinkToken(token, "brand new password 3");
    expect(used.ok).toBe(true);
    expect(await users.useLinkToken(token, "again password 4")).toMatchObject({ ok: false }); // single use
    expect((await users.getUser(staffId))!.sessionVersion).toBe(before + 1);
    expect(await users.checkPassword("staff@example.com", "brand new password 3")).toMatchObject({
      ok: true,
    });
  });

  it("emailed sign-in codes work once, only the newest works, and recovery codes are a backup", async () => {
    const first = await users.createLoginCode(ownerId);
    const second = await users.createLoginCode(ownerId);
    expect(second).toMatch(/^\d{6}$/);
    if (first !== second) {
      expect(await users.checkSecondFactor(ownerId, first)).toMatchObject({ ok: false });
    }
    expect(await users.checkSecondFactor(ownerId, second)).toEqual({
      ok: true,
      usedRecovery: false,
    });
    expect(await users.checkSecondFactor(ownerId, second)).toMatchObject({ ok: false }); // used

    // another person's code never works for this account
    const staffCode = await users.createLoginCode(staffId);
    const ownerCode = await users.createLoginCode(ownerId);
    if (staffCode !== ownerCode) {
      expect(await users.checkSecondFactor(ownerId, staffCode)).toMatchObject({ ok: false });
    }

    const codes = await users.regenerateRecoveryCodes(ownerId);
    expect(codes).toHaveLength(10);
    const rc = codes[0]!;
    expect(await users.checkSecondFactor(ownerId, rc.toUpperCase())).toEqual({
      ok: true,
      usedRecovery: true,
    });
    expect(await users.checkSecondFactor(ownerId, rc)).toMatchObject({ ok: false });
    expect(await users.recoveryCodesLeft(ownerId)).toBe(9);
    await users.recordLogin(ownerId); // clears the failed attempts above
  });

  it("locks after 5 wrong codes, even with a valid code afterwards", async () => {
    const code = await users.createLoginCode(ownerId);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await users.checkSecondFactor(ownerId, wrong);
    expect(await users.checkSecondFactor(ownerId, code)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Too many failed attempts"),
    });
    await users.recordLogin(ownerId);
  });

  it("expired codes are refused", async () => {
    const code = await users.createLoginCode(ownerId);
    const db = await getDb();
    await db.query(
      "UPDATE admin_tokens SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE user_id = ? AND purpose = 'login'",
      [ownerId],
    );
    expect(await users.checkSecondFactor(ownerId, code)).toMatchObject({ ok: false });
    await users.recordLogin(ownerId);
  });

  it("keeps at least one owner and stops people changing their own role", async () => {
    expect(
      await users.updateUser(ownerId, ownerId, { role: "staff", active: true, name: "Owner" }),
    ).toMatchObject({
      ok: false,
    });
    expect(
      await users.updateUser(staffId, ownerId, { role: "manager", active: true, name: "Owner" }),
    ).toEqual({
      ok: false,
      error: "There must always be at least one active Owner.",
    });
    const before = (await users.getUser(staffId))!.sessionVersion;
    expect(
      await users.updateUser(ownerId, staffId, { role: "manager", active: true, name: "Staff" }),
    ).toMatchObject({
      ok: true,
    });
    // role change signs them out
    expect((await users.getUser(staffId))!.sessionVersion).toBe(before + 1);
    await users.updateUser(ownerId, staffId, { role: "manager", active: false, name: "Staff" });
    expect(await users.getUser(staffId)).toBeNull(); // deactivated accounts can't sign in
    expect(await users.checkPassword("staff@example.com", "brand new password 3")).toMatchObject({
      ok: false,
    });
  });

  it("records the audit log without secrets", async () => {
    await audit.audit({ id: ownerId, email: "owner@example.com" }, "product.updated", "#1 Whey", {
      price: "100 → 120",
      password: "should not appear",
    });
    await audit.audit(null, "login.failed", "x@example.com", undefined, "warning");
    const all = await audit.listAudit({});
    expect(all[0]).toMatchObject({ action: "login.failed", severity: "warning" });
    expect(all[1]).toMatchObject({ action: "product.updated", actorEmail: "owner@example.com" });
    expect(all[1]!.details).toBe('{"price":"100 → 120"}');
    expect((await audit.listAudit({ severity: "warning" })).map((e) => e.action)).toEqual([
      "login.failed",
    ]);
    expect((await audit.listAudit({ q: "Whey" })).length).toBe(1);
    expect(audit.auditToCsv(all).split("\n")[0]).toContain("Action");
  });

  it("builds dashboard figures", async () => {
    const stats = await getDashboardStats(true);
    expect(stats.daily).toHaveLength(30);
    expect(stats.revenue.allTimePaise).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats.lowStock)).toBe(true);
  });
});
