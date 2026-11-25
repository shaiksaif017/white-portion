// Admin sign-in screens: email + password, then a 6-digit code sent by email
// (or a recovery code), forgotten password, and first-time Owner setup.
import { KeyRound, Lock, Mail, Shield } from "lucide-react";
import { useState } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  adminCreateOwner,
  adminForgotPassword,
  adminResendSignInCode,
  adminSignIn,
  adminSignInCode,
} from "@/lib/admin-auth-api";
import { type AdminSessionView, PASSWORD_RULE } from "@/lib/admin-types";
import { brand } from "@/lib/brand";

const field =
  "w-full p-3 rounded bg-charcoal border border-rule-light text-sm text-paper placeholder:text-paper-faint focus:border-gold-accent focus:outline-none";
const lbl = "block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2";

function Shell({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-charcoal text-paper flex flex-col justify-between">
      <SiteHeader isSolid />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-paper/5 border border-rule-light p-8 md:p-10 rounded shadow-2xl backdrop-blur-sm">
          <div className="text-center space-y-2 mb-8">
            <div className="w-12 h-12 bg-primary/20 text-gold-accent rounded-full flex items-center justify-center mx-auto mb-3 border border-gold-accent/30">
              {icon}
            </div>
            <h1 className="text-2xl font-display font-medium text-paper">{title}</h1>
            <p className="text-xs text-paper-soft">{sub}</p>
          </div>
          {children}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div
      role="alert"
      className="p-3 rounded bg-destructive/20 border border-destructive/40 text-destructive-foreground text-xs"
    >
      {text}
    </div>
  );
}

type Step =
  | { kind: "password" }
  | { kind: "code"; ticket: string; sentTo: string }
  | { kind: "forgot" }
  | { kind: "sent"; email: string };

export function AdminSignIn({
  session,
  onChanged,
}: {
  session: AdminSessionView;
  onChanged: () => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>({ kind: "password" });
  if (session.state === "bootstrap" && step.kind !== "code") {
    return (
      <OwnerSetup onCodeSent={(ticket, sentTo) => setStep({ kind: "code", ticket, sentTo })} />
    );
  }
  if (step.kind === "code")
    return (
      <CodeStep
        ticket={step.ticket}
        sentTo={step.sentTo}
        onBack={() => setStep({ kind: "password" })}
        onDone={onChanged}
      />
    );
  if (step.kind === "forgot" || step.kind === "sent")
    return (
      <Forgot
        sentTo={step.kind === "sent" ? step.email : null}
        onSent={(email) => setStep({ kind: "sent", email })}
        onBack={() => setStep({ kind: "password" })}
      />
    );
  return (
    <PasswordStep
      configured={session.configured}
      onBootstrap={onChanged}
      onCode={(ticket, sentTo) => setStep({ kind: "code", ticket, sentTo })}
      onForgot={() => setStep({ kind: "forgot" })}
    />
  );
}

function PasswordStep({
  configured,
  onBootstrap,
  onCode,
  onForgot,
}: {
  configured: boolean;
  onBootstrap: () => Promise<void> | void;
  onCode: (ticket: string, sentTo: string) => void;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      icon={<Shield className="w-6 h-6" />}
      title="Administration Portal"
      sub={`Protected area for the ${brand.name} team.`}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = await adminSignIn({ data: { email, password } });
            if (!r.ok) return setError(r.error);
            setPassword("");
            if (r.next === "code") onCode(r.ticket, r.sentTo);
            else await onBootstrap();
          } catch {
            setError("Please check the details and try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label className={lbl} htmlFor="adm-email">
            Email
          </label>
          <input
            id="adm-email"
            type="email"
            autoComplete="username"
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@officialwhiteportion.com"
          />
          <p className="text-[10px] text-paper-faint mt-1">
            First time? Leave email empty and use the existing admin password to create your Owner
            account.
          </p>
        </div>
        <div>
          <label className={lbl} htmlFor="adm-pass">
            Password
          </label>
          <div className="relative">
            <input
              id="adm-pass"
              type="password"
              autoComplete="current-password"
              required
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Lock className="w-4 h-4 text-paper-faint absolute right-3 top-3.5" />
          </div>
        </div>
        <ErrorBox text={error} />
        <Button type="submit" variant="hero" className="w-full !mt-6" disabled={busy}>
          {busy ? "CHECKING…" : "SIGN IN"}
        </Button>
        <button
          type="button"
          className="w-full text-[11px] text-paper-faint hover:text-paper"
          onClick={onForgot}
        >
          Forgot password?
        </button>
        {!configured && (
          <p className="text-[11px] text-paper-faint text-center">
            Admin login is not configured on the server yet.
          </p>
        )}
      </form>
    </Shell>
  );
}

function CodeStep({
  ticket,
  sentTo,
  onBack,
  onDone,
}: {
  ticket: string;
  sentTo: string;
  onBack: () => void;
  onDone: () => Promise<void> | void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    sentTo ? `We've emailed a 6-digit code to ${sentTo}. It expires in 10 minutes.` : null,
  );
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      icon={<Mail className="w-6 h-6" />}
      title="Check your email"
      sub="Enter the sign-in code we sent you."
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = await adminSignInCode({ data: { ticket, code } });
            if (!r.ok) return setError(r.error);
            await onDone();
          } catch {
            setError("Enter the 6-digit code from the email.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {info && (
          <p
            className="text-xs text-paper-soft bg-paper/5 border border-rule-light rounded p-3"
            role="status"
          >
            {info}
          </p>
        )}
        {!sentTo && !info && (
          <ErrorBox text="We couldn't send the email just now. Try “Send a new code”, or enter a recovery code." />
        )}
        <div>
          <label className={lbl} htmlFor="adm-code">
            Sign-in code
          </label>
          <input
            id="adm-code"
            className={`${field} text-center tracking-[0.4em] text-lg`}
            autoComplete="one-time-code"
            maxLength={9}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p className="text-[11px] text-paper-faint mt-2">
            Can't get the email? Enter one of your recovery codes (like abcd-efgh) instead.
          </p>
        </div>
        <ErrorBox text={error} />
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          {busy ? "CHECKING…" : "SIGN IN"}
        </Button>
        <div className="flex justify-between text-[11px]">
          <button type="button" className="text-paper-faint hover:text-paper" onClick={onBack}>
            Start again
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-gold-accent"
            onClick={async () => {
              setError(null);
              const r = await adminResendSignInCode({ data: { ticket } }).catch(() => null);
              if (!r) return setError("Could not reach the server.");
              if (!r.ok) return setError(r.error);
              setInfo(`A new code is on its way to ${r.sentTo}. Only the newest code works.`);
            }}
          >
            Send a new code
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Forgot({
  sentTo,
  onSent,
  onBack,
}: {
  sentTo: string | null;
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      icon={<KeyRound className="w-6 h-6" />}
      title="Reset your password"
      sub="We'll email you a link that works once for 30 minutes."
    >
      {sentTo ? (
        <div className="space-y-4 text-sm text-paper-soft">
          <p role="status">
            If {sentTo} has an admin account, a reset link is on its way. Check your inbox (and spam
            folder).
          </p>
          <button type="button" className="text-xs text-gold-accent" onClick={onBack}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await adminForgotPassword({ data: { email } });
              if (!r.ok) return setError(r.error);
              onSent(email);
            } catch {
              setError("Enter a valid email address.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label className={lbl} htmlFor="adm-femail">
              Admin email
            </label>
            <input
              id="adm-femail"
              type="email"
              required
              autoComplete="username"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <ErrorBox text={error} />
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? "SENDING…" : "EMAIL ME A RESET LINK"}
          </Button>
          <button
            type="button"
            className="w-full text-[11px] text-paper-faint hover:text-paper"
            onClick={onBack}
          >
            Back to sign in
          </button>
        </form>
      )}
    </Shell>
  );
}

function OwnerSetup({ onCodeSent }: { onCodeSent: (ticket: string, sentTo: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      icon={<Shield className="w-6 h-6" />}
      title="Create your Owner account"
      sub="One-time setup. Each person now signs in with their own email and password, plus a code sent to their email."
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (form.password !== form.confirm) return setError("The two passwords don't match.");
          setBusy(true);
          try {
            const r = await adminCreateOwner({
              data: { name: form.name, email: form.email, password: form.password },
            });
            if (!r.ok) return setError(r.error);
            onCodeSent(r.ticket, r.sentTo);
          } catch {
            setError(
              `Check the email address and use a password with ${PASSWORD_RULE.toLowerCase()}.`,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label className={lbl} htmlFor="own-name">
            Your name
          </label>
          <input
            id="own-name"
            required
            minLength={2}
            className={field}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className={lbl} htmlFor="own-email">
            Your email (sign-in codes are sent here)
          </label>
          <input
            id="own-email"
            type="email"
            required
            autoComplete="username"
            className={field}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className={lbl} htmlFor="own-pass">
            New password ({PASSWORD_RULE.toLowerCase()})
          </label>
          <input
            id="own-pass"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={field}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div>
          <label className={lbl} htmlFor="own-pass2">
            Repeat password
          </label>
          <input
            id="own-pass2"
            type="password"
            required
            autoComplete="new-password"
            className={field}
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
        <ErrorBox text={error} />
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          {busy ? "CREATING…" : "CREATE OWNER ACCOUNT"}
        </Button>
        <p className="text-[11px] text-paper-faint">
          After this, the old shared admin password stops working.
        </p>
      </form>
    </Shell>
  );
}
