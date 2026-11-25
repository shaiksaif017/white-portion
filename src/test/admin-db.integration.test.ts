// Real-database test for admin accounts, 2FA, recovery codes, reset links, roles,
// the audit log and the dashboard. Runs only with DB_TEST=1 on a throwaway database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env["DB_TEST"] === "1";

describe.skipIf(!enabled)("admin security against a real database", async () => {
  process.env["SESSION_SECRET"] ??= "w".repeat(40);
  process.env["ADMIN_PASSWORD_HASH"] ??= "scrypt:00:00";
  const users = await import("@/server/admin-users");
  const totp = await import("@/server/totp");
  const audit = await import("@/server/audit");
  const { getDashboardStats } = await import("@/server/dashboard");
  const { decryptSecret } = await import("@/server/secrets");
  const { getDb } = await import("@/server/db");

  let ownerId = 0;
  let staffId = 0;

  beforeAll(async () => {
    const db = await getDb();
    for (const t of ["admin_recovery_codes", "admin_tokens", "admin_users", "audit_log"])
      await db.query(`DELETE FROM ${t}`);
  });
  afterAll(async () => {
    await (await getDb()).end();
  });

  const pendingSecret = async (id: number) => {
    const db = await getDb();
    const [r] = await db.query<import("mysql2").RowDataPacket[]>(
      "SELECT totp_pending FROM admin_users WHERE id = ?",
      [id],
    );
    return decryptSecret(String(r[0]?.["totp_pending"]))!;
  };

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

  it("sets up 2FA, refuses replayed codes, and accepts each recovery code once", async () => {
    await users.startMfaSetup(ownerId);
    const secret = await pendingSecret(ownerId);
    expect(await users.confirmMfaSetup(ownerId, "000000")).toMatchObject({ ok: false });
    const step = totp.currentStep();
    const confirmed = await users.confirmMfaSetup(ownerId, totp.totpAt(secret, step));
    if (!confirmed.ok) throw new Error(confirmed.error);
    expect(confirmed.recoveryCodes).toHaveLength(10);
    expect((await users.getUser(ownerId))!.mfaEnabled).toBe(true);

    // the code used for setup can't be used again to sign in
    expect(await users.checkSecondFactor(ownerId, totp.totpAt(secret, step))).toMatchObject({
      ok: false,
    });
    expect(await users.checkSecondFactor(ownerId, totp.totpAt(secret, step + 1))).toEqual({
      ok: true,
      usedRecovery: false,
    });
    const rc = confirmed.recoveryCodes[0]!;
    expect(await users.checkSecondFactor(ownerId, rc.toUpperCase())).toEqual({
      ok: true,
      usedRecovery: true,
    });
    expect(await users.checkSecondFactor(ownerId, rc)).toMatchObject({ ok: false });
    expect(await users.recoveryCodesLeft(ownerId)).toBe(9);
    // two failed codes above count towards the lockout; a good sign-in resets it
    await users.recordLogin(ownerId);

    await users.resetMfa(ownerId);
    expect((await users.getUser(ownerId))!.mfaEnabled).toBe(false);
    expect(await users.recoveryCodesLeft(ownerId)).toBe(0);
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
