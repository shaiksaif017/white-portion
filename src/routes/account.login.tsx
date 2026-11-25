import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requestLoginCode, verifyLoginCode } from "@/lib/account-api";
import { brand } from "@/lib/brand";

// Only same-site paths are accepted as a "return to" address (no open redirects).
const safePath = z
  .string()
  .regex(/^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/)
  .max(300)
  .optional()
  .catch(undefined);

export const Route = createFileRoute("/account/login")({
  validateSearch: z.object({ redirect: safePath }),
  head: () => ({
    meta: [{ title: `Log in | ${brand.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

const input = "w-full p-3 rounded border border-border bg-background text-sm";

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await requestLoginCode({ data: { email } });
      if (!r.ok) return setError(r.error);
      setStep("code");
      setCode("");
      setInfo(`We've emailed a 6-digit code to ${email.trim()}. It expires in 10 minutes.`);
    } catch (err) {
      setError(
        err instanceof Error && /email/i.test(err.message)
          ? "Enter a valid email address."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await verifyLoginCode({ data: { email, code } });
      if (!r.ok) return setError(r.error);
      if (redirect) window.location.assign(redirect);
      else void navigate({ to: "/account" });
    } catch {
      setError("Enter the 6-digit code from the email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <SiteHeader isSolid />
      <section className="page-section section-wrap bg-cream !pt-10 min-h-[60vh]">
        <div className="max-w-md mx-auto">
          <Link
            to="/"
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-6"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Home
          </Link>
          <div className="page-card !p-8 space-y-5">
            <div className="space-y-2">
              <span className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Mail className="w-5 h-5" aria-hidden="true" />
              </span>
              <h1 className="text-3xl font-display font-medium text-charcoal">Your account</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                See your orders, download your e-books and continue your courses. No password
                needed: we'll email you a one-time code.
              </p>
            </div>

            {step === "email" ? (
              <form onSubmit={sendCode} className="space-y-3">
                <label htmlFor="login-email" className="block text-xs font-bold text-charcoal">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  className={input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Use the email you used at checkout to see your purchases.
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep disabled:opacity-60"
                >
                  {busy ? "SENDING…" : "EMAIL ME A CODE"}
                </button>
              </form>
            ) : (
              <form onSubmit={verify} className="space-y-3">
                {info && (
                  <p className="text-xs text-charcoal bg-secondary rounded p-3" role="status">
                    {info}
                  </p>
                )}
                <label htmlFor="login-code" className="block text-xs font-bold text-charcoal">
                  6-digit code
                </label>
                <input
                  id="login-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  className={`${input} tracking-[0.5em] text-center text-lg font-semibold`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="w-full px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep disabled:opacity-60"
                >
                  {busy ? "CHECKING…" : "LOG IN"}
                </button>
                <div className="flex justify-between text-[11px]">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setStep("email");
                      setError(null);
                    }}
                  >
                    Use a different email
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-primary font-semibold"
                    onClick={() => void sendCode()}
                  >
                    Send a new code
                  </button>
                </div>
              </form>
            )}
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
