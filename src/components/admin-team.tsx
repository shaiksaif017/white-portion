// Admin > Team (Owner only): invite people, set roles, deactivate, sign people out.
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  adminInviteUser,
  adminListUsers,
  adminResendInvite,
  adminSignOutUser,
  adminUpdateUser,
} from "@/lib/admin-auth-api";
import {
  type AdminRole,
  type AdminUserView,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
} from "@/lib/admin-types";

const input = "p-2.5 rounded border border-border bg-background text-xs";
const ROLES: AdminRole[] = ["owner", "manager", "staff"];

export function AdminTeam({ me, fail }: { me: string; fail: (msg: string) => void }) {
  const [list, setList] = useState<AdminUserView[] | null>(null);
  const [form, setForm] = useState({ email: "", name: "", role: "staff" as AdminRole });
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const r = await adminListUsers();
      if (r.ok) setList(r.users);
      else fail(r.error);
    } catch {
      fail("Could not reach the server.");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  async function act(p: Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    try {
      const r = await p;
      if (!r.ok) {
        if (/session has expired/i.test(r.error)) fail(r.error);
        else setMsg(r.error);
        return;
      }
      setMsg(done);
      await load();
    } catch {
      setMsg("Please check the details and try again.");
    }
  }

  return (
    <div className="space-y-6 text-xs">
      <div>
        <h3 className="text-xl font-display font-medium text-charcoal">Team</h3>
        <p className="text-muted-foreground">
          Everyone signs in with their own email and password, plus a code emailed to them each
          time.
        </p>
      </div>

      <form
        className="p-4 rounded border border-border bg-secondary/30 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          try {
            const r = await adminInviteUser({ data: form });
            if (!r.ok) return setMsg(r.error);
            setMsg(
              r.emailed
                ? `Invite emailed to ${form.email}.`
                : `Account created, but the invite email failed. Use "Resend invite" once email works.`,
            );
            setForm({ email: "", name: "", role: "staff" });
            await load();
          } catch {
            setMsg("Enter a name and a valid email address.");
          }
        }}
      >
        <div>
          <label className="block font-bold mb-1" htmlFor="tm-name">
            Name
          </label>
          <input
            id="tm-name"
            required
            minLength={2}
            className={`${input} w-full`}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block font-bold mb-1" htmlFor="tm-email">
            Email
          </label>
          <input
            id="tm-email"
            type="email"
            required
            className={`${input} w-full`}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block font-bold mb-1" htmlFor="tm-role">
            Role
          </label>
          <select
            id="tm-role"
            className={`${input} w-full`}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="hero" className="text-xs">
          Invite
        </Button>
        <p className="md:col-span-4 text-muted-foreground">
          {ROLE_LABEL[form.role]}: {ROLE_DESCRIPTION[form.role]}
        </p>
      </form>

      {msg && (
        <p className="font-semibold text-charcoal" role="status">
          {msg}
        </p>
      )}

      {list === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded bg-background">
          <table className="w-full text-left">
            <thead className="bg-secondary/70 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2.5">Person</th>
                <th className="p-2.5">Role</th>
                <th className="p-2.5">Last sign-in</th>
                <th className="p-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((u) => {
                const self = u.email === me;
                return (
                  <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                    <td className="p-2.5">
                      <div className="font-semibold text-charcoal">
                        {u.name}
                        {self && " (you)"}
                      </div>
                      <div className="text-muted-foreground">{u.email}</div>
                      {u.invitePending && (
                        <div className="text-amber-700 font-semibold">Invite not accepted yet</div>
                      )}
                      {!u.active && <div className="font-semibold">Deactivated</div>}
                    </td>
                    <td className="p-2.5">
                      <select
                        aria-label={`Role for ${u.email}`}
                        className={input}
                        disabled={self || !u.active}
                        value={u.role}
                        onChange={(e) => {
                          const role = e.target.value as AdminRole;
                          if (
                            confirm(
                              `Change ${u.email} to ${ROLE_LABEL[role]}? They'll be signed out.`,
                            )
                          )
                            void act(
                              adminUpdateUser({
                                data: { id: u.id, name: u.name, role, active: u.active },
                              }),
                              "Role updated.",
                            );
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Never"}
                    </td>
                    <td className="p-2.5 space-x-3 whitespace-nowrap">
                      {!self && u.active && u.invitePending && (
                        <button
                          type="button"
                          className="text-primary font-semibold"
                          onClick={() =>
                            void act(
                              adminResendInvite({ data: { id: u.id } }).then((r) =>
                                r.ok ? { ok: true as const } : r,
                              ),
                              "Invite sent again.",
                            )
                          }
                        >
                          Resend invite
                        </button>
                      )}
                      {!self && u.active && (
                        <button
                          type="button"
                          className="text-primary"
                          onClick={() =>
                            void act(
                              adminSignOutUser({ data: { id: u.id } }),
                              "Signed out of all devices.",
                            )
                          }
                        >
                          Sign out
                        </button>
                      )}
                      {!self && (
                        <button
                          type="button"
                          className={u.active ? "text-destructive" : "text-primary font-semibold"}
                          onClick={() =>
                            confirm(
                              u.active
                                ? `Deactivate ${u.email}? They lose access immediately.`
                                : `Reactivate ${u.email}?`,
                            ) &&
                            void act(
                              adminUpdateUser({
                                data: { id: u.id, name: u.name, role: u.role, active: !u.active },
                              }),
                              u.active ? "Deactivated." : "Reactivated.",
                            )
                          }
                        >
                          {u.active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
