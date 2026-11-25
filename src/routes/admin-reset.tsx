// Choose a new admin password from an emailed invite or reset link.
import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { adminPeekLink, adminUseLink } from "@/lib/admin-auth-api";
import { PASSWORD_RULE } from "@/lib/admin-types";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/admin-reset")({
  validateSearch: z.object({ token: z.string().max(100).catch("") }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) =>
    deps.token.length >= 20
      ? adminPeekLink({ data: { token: deps.token } })
      : { valid: false as const },
  head: () => ({
    meta: [
      { title: `Set password | ${brand.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPage,
});

const field =
  "w-full p-3 rounded bg-charcoal border border-rule-light text-sm text-paper focus:border-gold-accent focus:outline-none";

function ResetPage() {
  const info = Route.useLoaderData();
  const { token } = Route.useSearch();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <main className="min-h-screen bg-charcoal text-paper flex flex-col justify-between">
      <SiteHeader isSolid />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-paper/5 border border-rule-light p-8 md:p-10 rounded shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <KeyRound className="w-8 h-8 mx-auto text-gold-accent" aria-hidden="true" />
            <h1 className="text-2xl font-display">
              {info.valid && info.purpose === "invite"
                ? "Welcome to the admin"
                : "Choose a new password"}
            </h1>
            {info.valid && <p className="text-xs text-paper-soft">{info.email}</p>}
          </div>
          {!info.valid ? (
            <p className="text-sm text-paper-soft text-center">
              This link has expired or was already used. Ask the owner for a new invite, or use
              "Forgot password" on the{" "}
              <Link to="/admin" className="text-gold-accent underline">
                sign-in page
              </Link>
              .
            </p>
          ) : done ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-paper-soft" role="status">
                Password saved. Sign in now; we'll email you a 6-digit code to finish signing in.
              </p>
              <Button asChild variant="hero">
                <Link to="/admin">GO TO SIGN IN</Link>
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                if (pw !== pw2) return setError("The two passwords don't match.");
                setBusy(true);
                try {
                  const r = await adminUseLink({ data: { token, password: pw } });
                  if (!r.ok) return setError(r.error);
                  setDone(true);
                } catch {
                  setError(`Use a password with ${PASSWORD_RULE.toLowerCase()}.`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div>
                <label
                  htmlFor="rp1"
                  className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2"
                >
                  New password ({PASSWORD_RULE.toLowerCase()})
                </label>
                <input
                  id="rp1"
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className={field}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="rp2"
                  className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2"
                >
                  Repeat password
                </label>
                <input
                  id="rp2"
                  type="password"
                  required
                  autoComplete="new-password"
                  className={field}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="text-xs text-destructive-foreground bg-destructive/20 border border-destructive/40 rounded p-3"
                >
                  {error}
                </p>
              )}
              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                {busy ? "SAVING…" : "SAVE PASSWORD"}
              </Button>
            </form>
          )}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
