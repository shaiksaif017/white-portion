// Shared admin checks for server functions and server routes. Every admin action calls
// adminFor(permission): it verifies the signed session cookie, that the account is
// still active with the same session version (so sign-outs and role changes apply
// at once), that the emailed code was entered, and that the role has the permission.
import { getCookie } from "@tanstack/react-start/server";

import { type Permission, can } from "@/lib/admin-types";
import { type AdminUser, getUser, parseAdminToken, touchAdmin } from "./admin-users";
import { type Actor, audit } from "./audit";
import { SESSION_COOKIE } from "./auth";
import { isDbConfigured } from "./db";

type Fail = { ok: false; error: string };
export const SESSION_EXPIRED: Fail = {
  ok: false,
  error: "Your session has expired. Please log in again.",
};
export const NO_PERMISSION: Fail = {
  ok: false,
  error: "Your role doesn't allow this. Ask the owner if you need access.",
};

export type AdminAuth =
  | {
      ok: true;
      user: AdminUser;
      actor: Actor;
      // records an audit entry for this admin
      log: (action: string, target?: string, details?: Record<string, unknown>) => Promise<void>;
    }
  | Fail;

// The signed-in admin, or the session state when not fully signed in.
export async function readAdminSession(): Promise<
  { kind: "none" } | { kind: "bootstrap" } | { kind: "ok"; user: AdminUser }
> {
  if (!isDbConfigured()) return { kind: "none" };
  const t = parseAdminToken(getCookie(SESSION_COOKIE));
  if (!t) return { kind: "none" };
  if (t.id === 0 && t.version === 0) return { kind: "bootstrap" };
  try {
    const user = await getUser(t.id);
    if (!user || user.sessionVersion !== t.version) return { kind: "none" };
    if (!t.mfa) return { kind: "none" };
    if (!(await touchAdmin(user.id, user.sessionVersion))) {
      void audit({ id: user.id, email: user.email }, "session.idle_timeout", user.email);
      return { kind: "none" };
    }
    return { kind: "ok", user };
  } catch (error) {
    console.error("[admin] session check failed", error);
    return { kind: "none" };
  }
}

export async function adminFor(perm: Permission): Promise<AdminAuth> {
  const s = await readAdminSession();
  if (s.kind !== "ok") return SESSION_EXPIRED;
  if (!can(s.user.role, perm)) {
    const actor = { id: s.user.id, email: s.user.email };
    void audit(actor, "permission.denied", perm, undefined, "warning");
    return NO_PERMISSION;
  }
  const actor = { id: s.user.id, email: s.user.email };
  return {
    ok: true,
    user: s.user,
    actor,
    log: (action, target, details) => audit(actor, action, target, details),
  };
}

// Blocks cross-site form posts to raw server routes (server functions already have CSRF protection).
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return (
      new URL(origin).host === new URL(request.url).host ||
      new URL(origin).host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}
