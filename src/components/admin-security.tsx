// Admin > Security: your own password / recovery codes / sessions, and (Owner) the audit log.
import { Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  adminChangePassword,
  adminExportAudit,
  adminListAudit,
  adminNewRecoveryCodes,
  adminSignOutEverywhere,
} from "@/lib/admin-auth-api";
import { type AuditEntry, PASSWORD_RULE } from "@/lib/admin-types";

const input = "p-2.5 rounded border border-border bg-background text-xs";

export function AdminSecurity({
  canAudit,
  recoveryCodesLeft,
  fail,
  onSignedOut,
}: {
  canAudit: boolean;
  recoveryCodesLeft: number;
  fail: (msg: string) => void;
  onSignedOut: () => void;
}) {
  return (
    <div className="space-y-8 text-xs">
      <MySecurity recoveryCodesLeft={recoveryCodesLeft} onSignedOut={onSignedOut} />
      {canAudit && <AuditLog fail={fail} />}
    </div>
  );
}

function MySecurity({
  recoveryCodesLeft,
  onSignedOut,
}: {
  recoveryCodesLeft: number;
  onSignedOut: () => void;
}) {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [rcPassword, setRcPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [rcMsg, setRcMsg] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-display font-medium text-charcoal">Your account security</h3>
        <p className="text-muted-foreground">
          Two-step verification is on. {recoveryCodesLeft} unused recovery code
          {recoveryCodesLeft === 1 ? "" : "s"} left.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form
          className="p-4 rounded border border-border bg-background space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setPwMsg(null);
            if (pw.next !== pw.confirm) return setPwMsg("The new passwords don't match.");
            try {
              const r = await adminChangePassword({ data: { current: pw.current, next: pw.next } });
              setPwMsg(r.ok ? "Password changed. Other devices were signed out." : r.error);
              if (r.ok) setPw({ current: "", next: "", confirm: "" });
            } catch {
              setPwMsg(`New password: ${PASSWORD_RULE.toLowerCase()}.`);
            }
          }}
        >
          <h4 className="font-bold text-charcoal">Change password</h4>
          <input
            type="password"
            aria-label="Current password"
            placeholder="Current password"
            autoComplete="current-password"
            required
            className={`${input} w-full`}
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
          <input
            type="password"
            aria-label="New password"
            placeholder={`New password (${PASSWORD_RULE.toLowerCase()})`}
            autoComplete="new-password"
            required
            minLength={10}
            className={`${input} w-full`}
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <input
            type="password"
            aria-label="Repeat new password"
            placeholder="Repeat new password"
            autoComplete="new-password"
            required
            className={`${input} w-full`}
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
          <Button type="submit" variant="hero" className="text-xs">
            Change password
          </Button>
          {pwMsg && (
            <p role="status" className="font-semibold">
              {pwMsg}
            </p>
          )}
        </form>

        <form
          className="p-4 rounded border border-border bg-background space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setRcMsg(null);
            const r = await adminNewRecoveryCodes({ data: { password: rcPassword } }).catch(
              () => null,
            );
            if (!r) return setRcMsg("Could not reach the server.");
            if (!r.ok) return setRcMsg(r.error);
            setCodes(r.recoveryCodes);
            setRcPassword("");
          }}
        >
          <h4 className="font-bold text-charcoal">New recovery codes</h4>
          <p className="text-muted-foreground">
            Replaces all old codes. Store the new ones safely.
          </p>
          {codes ? (
            <ol className="grid grid-cols-2 gap-1 font-mono text-[11px] bg-secondary/40 rounded p-2">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
          ) : (
            <>
              <input
                type="password"
                aria-label="Your password"
                placeholder="Your password"
                autoComplete="current-password"
                required
                className={`${input} w-full`}
                value={rcPassword}
                onChange={(e) => setRcPassword(e.target.value)}
              />
              <Button type="submit" variant="outline" className="text-xs">
                Create new codes
              </Button>
            </>
          )}
          {rcMsg && (
            <p role="alert" className="font-semibold">
              {rcMsg}
            </p>
          )}
        </form>

        <div className="p-4 rounded border border-border bg-background space-y-2">
          <h4 className="font-bold text-charcoal">Signed in somewhere else?</h4>
          <p className="text-muted-foreground">
            Signs you out on every device, including this one.
          </p>
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            onClick={async () => {
              if (!confirm("Sign out of all devices?")) return;
              await adminSignOutEverywhere().catch(() => null);
              onSignedOut();
            }}
          >
            Sign out everywhere
          </Button>
        </div>
      </div>
    </section>
  );
}

function AuditLog({ fail }: { fail: (msg: string) => void }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState<"" | "warning" | "alert">("");

  async function load() {
    setEntries(null);
    try {
      const r = await adminListAudit({
        data: { ...(q ? { q } : {}), ...(severity ? { severity } : {}) },
      });
      if (r.ok) setEntries(r.entries);
      else fail(r.error);
    } catch {
      fail("Could not reach the server.");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on filter change
  }, [severity]);

  async function exportCsv() {
    const r = await adminExportAudit({
      data: { ...(q ? { q } : {}), ...(severity ? { severity } : {}) },
    });
    if (!r.ok) return fail(r.error);
    const blob = new Blob(["﻿" + r.csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wpw-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-display font-medium text-charcoal">Audit log</h3>
          <p className="text-muted-foreground">
            Sign-ins, failed attempts and every change to products, prices, stock, orders, refunds,
            courses, settings and team. Passwords, codes and keys are never recorded.
          </p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <input
            type="search"
            aria-label="Search the audit log"
            placeholder="Search person, action, order…"
            className={`${input} w-56`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            aria-label="Severity"
            className={input}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
          >
            <option value="">Everything</option>
            <option value="warning">Warnings and alerts</option>
            <option value="alert">Alerts only</option>
          </select>
          <Button type="submit" variant="outline" className="text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Search
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            onClick={() => void exportCsv()}
          >
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
        </form>
      </div>
      {entries === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded bg-background max-h-[60vh]">
          <table className="w-full text-left">
            <thead className="bg-secondary/70 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Who</th>
                <th className="p-2">What</th>
                <th className="p-2">Target</th>
                <th className="p-2">Details</th>
                <th className="p-2">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className={
                    e.severity === "alert"
                      ? "bg-destructive/10"
                      : e.severity === "warning"
                        ? "bg-amber-500/10"
                        : ""
                  }
                >
                  <td className="p-2 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </td>
                  <td className="p-2">{e.actorEmail || "—"}</td>
                  <td className="p-2 font-semibold whitespace-nowrap">{e.action}</td>
                  <td className="p-2">{e.target}</td>
                  <td className="p-2 font-mono text-[10px] max-w-md break-words">{e.details}</td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
