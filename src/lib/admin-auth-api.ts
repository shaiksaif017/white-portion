// Server functions for admin sign-in, 2FA, password reset, team management, the
// audit log and the sales dashboard.
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  type AdminSessionView,
  type AdminUserView,
  type AuditEntry,
  type DashboardStats,
  AdminEmailSchema,
  PasswordSchema,
  ROLE_LABEL,
} from "@/lib/admin-types";
import { brand } from "@/lib/brand";
import * as users from "@/server/admin-users";
import { adminFor, readAdminSession, SESSION_EXPIRED } from "@/server/admin-session";
import { audit, auditToCsv, listAudit, securityAlert } from "@/server/audit";
import { rateLimit, resetRateLimit, SESSION_COOKIE, verifyPassword } from "@/server/auth";
import { getDashboardStats } from "@/server/dashboard";
import { isDbConfigured } from "@/server/db";
import { authConfig, isProduction, siteUrl } from "@/server/env";
import { sendEmail } from "@/server/mailer";
import { otpauthUri } from "@/server/totp";

type Fail = { ok: false; error: string };
const NOT_SET_UP: Fail = {
  ok: false,
  error: "Admin login is not set up on the server yet (SESSION_SECRET and database).",
};

function ip(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

function setSession(userId: number, version: number, mfa: boolean) {
  setCookie(SESSION_COOKIE, users.createAdminToken(userId, version, mfa), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge: users.ADMIN_SESSION_HOURS * 3600,
  });
}

// ---------- session ----------

export const getAdminSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSessionView> => {
    const configured = authConfig() !== null && isDbConfigured();
    if (!configured) return { configured, state: "none", user: null };
    const s = await readAdminSession();
    if (s.kind === "none" || s.kind === "bootstrap")
      return { configured, state: s.kind, user: null };
    return {
      configured,
      state: s.kind,
      user: {
        email: s.user.email,
        name: s.user.name,
        role: s.user.role,
        permissions: users.permissionsFor(s.user.role),
        recoveryCodesLeft: s.kind === "ok" ? await users.recoveryCodesLeft(s.user.id) : 0,
      },
    };
  },
);

// ---------- sign in ----------

export type LoginResult =
  { ok: true; next: "done" | "totp" | "mfa_setup" | "bootstrap"; ticket?: string } | Fail;

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().trim().max(254), password: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }): Promise<LoginResult> => {
    const config = authConfig();
    if (!config || !isDbConfigured()) return NOT_SET_UP;
    if (!rateLimit(`admin-login:${ip()}`, 10, 15 * 60_000)) {
      void audit(null, "login.rate_limited", data.email, undefined, "warning");
      return { ok: false, error: "Too many attempts from this network. Please wait 15 minutes." };
    }
    try {
      // First run: no admin accounts yet, so the old shared password (ADMIN_PASSWORD_HASH)
      // opens a one-time setup screen to create the Owner account.
      if ((await users.countUsers()) === 0) {
        if (!verifyPassword(data.password, config.passwordHash)) {
          void audit(null, "login.failed", "setup password", undefined, "warning");
          return { ok: false, error: "Incorrect password." };
        }
        setSession(0, 0, false);
        void audit(null, "login.bootstrap", "first-time owner setup");
        return { ok: true, next: "bootstrap" };
      }
      const email = data.email.toLowerCase();
      const r = await users.checkPassword(email, data.password);
      if (!r.ok) {
        void audit(
          r.userId ? { id: r.userId, email } : null,
          "login.failed",
          email,
          undefined,
          r.locked ? "alert" : "warning",
        );
        if (r.locked && r.userId) {
          void securityAlert("Admin account locked", [
            `The admin account ${email} was locked after repeated failed sign-in attempts.`,
          ]);
        }
        return { ok: false, error: r.error };
      }
      if (r.user.mfaEnabled) {
        return { ok: true, next: "totp", ticket: users.createMfaTicket(r.user.id) };
      }
      // No 2FA yet: signed in only far enough to set it up.
      await users.recordLogin(r.user.id);
      setSession(r.user.id, r.user.sessionVersion, false);
      void audit({ id: r.user.id, email }, "login.password_ok_mfa_setup", email);
      return { ok: true, next: "mfa_setup" };
    } catch (error) {
      console.error("[admin] sign in failed", error);
      return { ok: false, error: "Could not sign in right now. Please try again." };
    }
  });

export const adminSignInCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ ticket: z.string().max(200), code: z.string().trim().max(20) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; usedRecovery: boolean } | Fail> => {
    if (!authConfig() || !isDbConfigured()) return NOT_SET_UP;
    if (!rateLimit(`admin-2fa:${ip()}`, 15, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait 15 minutes." };
    }
    const userId = users.parseMfaTicket(data.ticket);
    if (!userId) return { ok: false, error: "That took too long. Please sign in again." };
    try {
      const user = await users.getUser(userId);
      if (!user) return { ok: false, error: "Please sign in again." };
      const actor = { id: user.id, email: user.email };
      const r = await users.checkSecondFactor(userId, data.code);
      if (!r.ok) {
        void audit(actor, "login.2fa_failed", user.email, undefined, "warning");
        return r;
      }
      await users.recordLogin(userId);
      resetRateLimit(`admin-login:${ip()}`);
      setSession(user.id, user.sessionVersion, true);
      void audit(actor, r.usedRecovery ? "login.ok_recovery_code" : "login.ok", user.email);
      if (r.usedRecovery) {
        const left = await users.recoveryCodesLeft(userId);
        void securityAlert("Recovery code used", [
          `${user.email} signed in with a 2FA recovery code. ${left} recovery codes left.`,
        ]);
      }
      return { ok: true, usedRecovery: r.usedRecovery };
    } catch (error) {
      console.error("[admin] 2fa failed", error);
      return { ok: false, error: "Could not sign in right now. Please try again." };
    }
  });

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const s = await readAdminSession();
  if (s.kind === "ok" || s.kind === "mfa_setup") {
    void audit({ id: s.user.id, email: s.user.email }, "logout", s.user.email);
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true as const };
});

// ---------- first owner ----------

export const adminCreateOwner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: AdminEmailSchema,
        name: z.string().trim().min(2).max(120),
        password: PasswordSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const s = await readAdminSession();
    if (s.kind !== "bootstrap" || (await users.countUsers()) > 0) return SESSION_EXPIRED;
    const r = await users.createUser(data.email, data.name, "owner", data.password);
    if (!r.ok) return r;
    const u = await users.getUser(r.id);
    if (!u) return SESSION_EXPIRED;
    setSession(u.id, u.sessionVersion, false); // next: set up 2FA
    void audit({ id: u.id, email: u.email }, "user.owner_created", u.email, undefined, "alert");
    return { ok: true };
  });

// ---------- 2FA setup (for the signed-in admin) ----------

async function selfForSetup() {
  const s = await readAdminSession();
  return s.kind === "ok" || s.kind === "mfa_setup" ? s.user : null;
}

export const adminStartMfa = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; secret: string; uri: string } | Fail> => {
    const me = await selfForSetup();
    if (!me) return SESSION_EXPIRED;
    if (me.mfaEnabled) return { ok: false, error: "2FA is already on." };
    const secret = await users.startMfaSetup(me.id);
    return { ok: true, secret, uri: otpauthUri(secret, me.email, brand.name) };
  },
);

export const adminConfirmMfa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; recoveryCodes: string[] } | Fail> => {
    const me = await selfForSetup();
    if (!me) return SESSION_EXPIRED;
    if (!rateLimit(`admin-2fa-setup:${me.id}`, 10, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait 15 minutes." };
    }
    const r = await users.confirmMfaSetup(me.id, data.code);
    if (!r.ok) return r;
    const fresh = await users.getUser(me.id);
    if (fresh) setSession(fresh.id, fresh.sessionVersion, true);
    await users.recordLogin(me.id);
    void audit({ id: me.id, email: me.email }, "security.2fa_enabled", me.email);
    return r;
  });

export const adminNewRecoveryCodes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; recoveryCodes: string[] } | Fail> => {
    const s = await readAdminSession();
    if (s.kind !== "ok") return SESSION_EXPIRED;
    const check = await users.checkPassword(s.user.email, data.password);
    if (!check.ok) return { ok: false, error: "Your password isn't right." };
    const codes = await users.regenerateRecoveryCodes(s.user.id);
    void audit(
      { id: s.user.id, email: s.user.email },
      "security.recovery_codes_regenerated",
      s.user.email,
    );
    return { ok: true, recoveryCodes: codes };
  });

export const adminChangePassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ current: z.string().min(1).max(200), next: PasswordSchema }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const s = await readAdminSession();
    if (s.kind !== "ok") return SESSION_EXPIRED;
    const r = await users.changePassword(s.user.id, data.current, data.next);
    if (!r.ok) {
      void audit(
        { id: s.user.id, email: s.user.email },
        "security.password_change_failed",
        s.user.email,
        undefined,
        "warning",
      );
      return r;
    }
    setSession(s.user.id, r.version, true); // stay signed in here; other devices are signed out
    void audit({ id: s.user.id, email: s.user.email }, "security.password_changed", s.user.email);
    return { ok: true };
  });

export const adminSignOutEverywhere = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true } | Fail> => {
    const s = await readAdminSession();
    if (s.kind !== "ok") return SESSION_EXPIRED;
    await users.signOutEverywhere(s.user.id);
    deleteCookie(SESSION_COOKIE, { path: "/" });
    void audit(
      { id: s.user.id, email: s.user.email },
      "security.signed_out_everywhere",
      s.user.email,
    );
    return { ok: true };
  },
);

// ---------- forgotten password / invites ----------

async function emailLink(
  user: { email: string; name: string },
  token: string,
  purpose: "invite" | "reset",
) {
  const link = `${siteUrl()}/admin-reset?token=${encodeURIComponent(token)}`;
  const first = user.name.split(" ")[0] || "there";
  return sendEmail(
    {
      type: "ADMIN_SECURITY",
      to: user.email,
      subject:
        purpose === "invite"
          ? `You've been invited to the ${brand.name} admin`
          : `Reset your ${brand.name} admin password`,
      text: [
        `Hi ${first},`,
        "",
        purpose === "invite"
          ? "You've been given access to the website admin. Use this link to choose your password (it expires in 3 days):"
          : "Use this link to choose a new admin password (it expires in 30 minutes and works once):",
        link,
        "",
        "After that you'll set up two-step verification with an authenticator app (Google Authenticator, Microsoft Authenticator or similar).",
        "",
        purpose === "reset"
          ? "If you didn't ask for this, ignore this email; your password stays the same."
          : "",
      ].join("\n"),
    },
    undefined,
    {
      logText: `${purpose === "invite" ? "Admin invite" : "Password reset"} link sent (link not stored in this log).`,
    },
  );
}

export const adminForgotPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: AdminEmailSchema }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!authConfig() || !isDbConfigured()) return NOT_SET_UP;
    if (
      !rateLimit(`admin-forgot-ip:${ip()}`, 5, 15 * 60_000) ||
      !rateLimit(`admin-forgot:${data.email}`, 3, 60 * 60_000)
    ) {
      return { ok: false, error: "Too many requests. Please wait and try again." };
    }
    try {
      const user = await users.findActiveByEmail(data.email);
      if (user) {
        const token = await users.createLinkToken(user.id, "reset");
        await emailLink(user, token, "reset");
        void audit(
          { id: user.id, email: user.email },
          "security.password_reset_requested",
          user.email,
          undefined,
          "warning",
        );
      } else {
        void audit(null, "security.password_reset_unknown_email", data.email, undefined, "warning");
      }
      // same answer either way, so admin emails can't be discovered
      return { ok: true };
    } catch (error) {
      console.error("[admin] forgot password failed", error);
      return { ok: false, error: "Could not send the email right now." };
    }
  });

export const adminPeekLink = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }) => {
    if (!isDbConfigured() || !authConfig()) return { valid: false as const };
    const r = await users.peekLinkToken(data.token);
    return r ? { valid: true as const, ...r } : { valid: false as const };
  });

export const adminUseLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(20).max(100), password: PasswordSchema }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!isDbConfigured() || !authConfig()) return NOT_SET_UP;
    if (!rateLimit(`admin-link:${ip()}`, 10, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait 15 minutes." };
    }
    const r = await users.useLinkToken(data.token, data.password);
    if (!r.ok) return r;
    void audit(
      { id: r.user.id, email: r.user.email },
      r.purpose === "invite" ? "user.invite_accepted" : "security.password_reset",
      r.user.email,
      undefined,
      "warning",
    );
    if (r.purpose === "reset") {
      void securityAlert("Admin password reset", [
        `The password for ${r.user.email} was reset by email link.`,
      ]);
    }
    // They still need their 2FA code (or to set 2FA up) when they sign in.
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

// ---------- team (owner) ----------

export const adminListUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; users: AdminUserView[] } | Fail> => {
    const admin = await adminFor("users");
    if (!admin.ok) return admin;
    return { ok: true, users: await users.listUsers() };
  },
);

const RoleSchema = z.enum(["owner", "manager", "staff"]);

export const adminInviteUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: AdminEmailSchema,
        name: z.string().trim().min(2).max(120),
        role: RoleSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; emailed: boolean } | Fail> => {
    const admin = await adminFor("users");
    if (!admin.ok) return admin;
    const r = await users.createUser(data.email, data.name, data.role);
    if (!r.ok) return r;
    const token = await users.createLinkToken(r.id, "invite");
    const sent = await emailLink({ email: data.email, name: data.name }, token, "invite");
    await admin.log("user.invited", data.email, { role: data.role });
    void securityAlert("New admin invited", [
      `${admin.user.email} invited ${data.email} as ${ROLE_LABEL[data.role]}.`,
    ]);
    return { ok: true, emailed: sent.status === "SENT" };
  });

export const adminResendInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; emailed: boolean } | Fail> => {
    const admin = await adminFor("users");
    if (!admin.ok) return admin;
    const u = (await users.listUsers()).find((x) => x.id === data.id && x.active);
    if (!u) return { ok: false, error: "Admin not found." };
    const token = await users.createLinkToken(u.id, "invite");
    const sent = await emailLink(u, token, "invite");
    await admin.log("user.invite_resent", u.email);
    return { ok: true, emailed: sent.status === "SENT" };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(120),
        role: RoleSchema,
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const admin = await adminFor("users");
    if (!admin.ok) return admin;
    const r = await users.updateUser(admin.user.id, data.id, data);
    if (!r.ok) return r;
    const changes: Record<string, unknown> = {};
    if (r.before.role !== data.role) changes["role"] = `${r.before.role} → ${data.role}`;
    if (r.before.active !== data.active) changes["active"] = `${r.before.active} → ${data.active}`;
    if (r.before.name !== data.name) changes["name"] = data.name;
    await admin.log("user.updated", r.before.email, changes);
    if (changes["role"] || changes["active"]) {
      void securityAlert("Admin access changed", [
        `${admin.user.email} changed ${r.before.email}: ${Object.entries(changes)
          .map(([k, v]) => `${k} ${String(v)}`)
          .join(", ")}.`,
      ]);
    }
    return { ok: true };
  });

export const adminResetUserMfa = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const admin = await adminFor("users");
    if (!admin.ok) return admin;
    if (data.id === admin.user.id) {
      return {
        ok: false,
        error: "Use your recovery codes, or ask another Owner to reset your 2FA.",
      };
    }
    const u = (await users.listUsers()).find((x) => x.id === data.id);
    if (!u) return { ok: false, error: "Admin not found." };
    await users.resetMfa(data.id);
    await admin.log("security.2fa_reset", u.email);
    void securityAlert("2FA reset", [
      `${admin.user.email} reset two-step verification for ${u.email}.`,
    ]);
    return { ok: true };
  });

export const adminSignOutUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const admin = await adminFor("users");
    if (!admin.ok) return admin;
    const u = (await users.listUsers()).find((x) => x.id === data.id);
    if (!u) return { ok: false, error: "Admin not found." };
    await users.signOutEverywhere(data.id);
    await admin.log("security.user_signed_out", u.email);
    return { ok: true };
  });

// ---------- audit log (owner) ----------

const AuditQuery = z.object({
  q: z.string().trim().max(100).optional(),
  severity: z.enum(["warning", "alert"]).optional(),
});

export const adminListAudit = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => AuditQuery.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; entries: AuditEntry[] } | Fail> => {
    const admin = await adminFor("audit");
    if (!admin.ok) return admin;
    return { ok: true, entries: await listAudit({ ...data, limit: 500 }) };
  });

export const adminExportAudit = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => AuditQuery.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; csv: string } | Fail> => {
    const admin = await adminFor("audit");
    if (!admin.ok) return admin;
    await admin.log("audit.exported");
    return { ok: true, csv: auditToCsv(await listAudit({ ...data, limit: 50_000 })) };
  });

// ---------- dashboard ----------

export const adminGetDashboardStats = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ includeSample: z.boolean() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; stats: DashboardStats } | Fail> => {
    const admin = await adminFor("dashboard");
    if (!admin.ok) return admin;
    try {
      return { ok: true, stats: await getDashboardStats(data.includeSample) };
    } catch (error) {
      console.error("[admin] dashboard stats failed", error);
      return { ok: false, error: "Could not load the dashboard." };
    }
  });
