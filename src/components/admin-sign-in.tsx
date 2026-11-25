// Admin sign-in screens: email + password, authenticator code, forgotten password,
// first-time Owner setup and mandatory two-step verification (2FA) setup.
import { KeyRound, Lock, Shield, Smartphone } from "lucide-react";
import { useState } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  adminConfirmMfa,
  adminCreateOwner,
  adminForgotPassword,
  adminSignIn,
  adminSignInCode,
  adminSignOut,
  adminStartMfa,
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

export function AdminSignIn({
  session,
  onChanged,
}: {
  session: AdminSessionView;
  onChanged: () => Promise<void> | void;
}) {
  if (session.state === "bootstrap") return <OwnerSetup onChanged={onChanged} />;
  if (session.state === "mfa_setup")
    return <MfaSetup email={session.user?.email ?? ""} onChanged={onChanged} />;
  return <PasswordSignIn configured={session.configured} onChanged={onChanged} />;
}

function PasswordSignIn({
  configured,
  onChanged,
}: {
  configured: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [mode, setMode] = useState<"password" | "code" | "forgot" | "sent">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("Please check the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "code") {
    return (
      <Shell
        icon={<Smartphone className="w-6 h-6" />}
        title="Two-step verification"
        sub="Enter the 6-digit code from your authenticator app."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await adminSignInCode({ data: { ticket, code } });
              if (!r.ok) return setError(r.error);
              setPassword("");
              await onChanged();
            });
          }}
        >
          <div>
            <label className={lbl} htmlFor="adm-code">
              Authentication code
            </label>
            <input
              id="adm-code"
              className={`${field} text-center tracking-[0.4em] text-lg`}
              inputMode="text"
              autoComplete="one-time-code"
              maxLength={9}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="text-[11px] text-paper-faint mt-2">
              Lost your phone? Enter one of your recovery codes (like abcd-efgh) instead.
            </p>
          </div>
          <ErrorBox text={error} />
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? "CHECKING…" : "VERIFY"}
          </Button>
          <button
            type="button"
            className="w-full text-[11px] text-paper-faint hover:text-paper"
            onClick={() => {
              setMode("password");
              setCode("");
            }}
          >
            Start again
          </button>
        </form>
      </Shell>
    );
  }

  if (mode === "forgot" || mode === "sent") {
    return (
      <Shell
        icon={<KeyRound className="w-6 h-6" />}
        title="Reset your password"
        sub="We'll email you a link that works once for 30 minutes."
      >
        {mode === "sent" ? (
          <div className="space-y-4 text-sm text-paper-soft">
            <p role="status">
              If {email} has an admin account, a reset link is on its way. Check your inbox (and
              spam folder).
            </p>
            <button
              type="button"
              className="text-xs text-gold-accent"
              onClick={() => setMode("password")}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await adminForgotPassword({ data: { email } });
                if (!r.ok) return setError(r.error);
                setMode("sent");
              });
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
              onClick={() => setMode("password")}
            >
              Back to sign in
            </button>
          </form>
        )}
      </Shell>
    );
  }

  return (
    <Shell
      icon={<Shield className="w-6 h-6" />}
      title="Administration Portal"
      sub={`Protected area for the ${brand.name} team.`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const r = await adminSignIn({ data: { email, password } });
            if (!r.ok) return setError(r.error);
            if (r.next === "totp" && r.ticket) {
              setTicket(r.ticket);
              setMode("code");
              return;
            }
            setPassword("");
            await onChanged();
          });
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
          onClick={() => {
            setMode("forgot");
            setError(null);
          }}
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

function OwnerSetup({ onChanged }: { onChanged: () => Promise<void> | void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      icon={<Shield className="w-6 h-6" />}
      title="Create your Owner account"
      sub="One-time setup. Each person now signs in with their own email, password and authenticator app."
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
            await onChanged();
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
            Your email
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

function MfaSetup({ email, onChanged }: { email: string; onChanged: () => Promise<void> | void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (codes) {
    return (
      <Shell
        icon={<KeyRound className="w-6 h-6" />}
        title="Save your recovery codes"
        sub="Each code works once if you lose your phone. They won't be shown again."
      >
        <div className="space-y-4">
          <ol className="grid grid-cols-2 gap-2 font-mono text-sm bg-charcoal border border-rule-light rounded p-4 text-paper">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="heroOutline"
              className="flex-1 text-xs"
              onClick={() => void navigator.clipboard?.writeText(codes.join("\n"))}
            >
              Copy
            </Button>
            <Button
              type="button"
              variant="heroOutline"
              className="flex-1 text-xs"
              onClick={() => {
                const blob = new Blob(
                  [`${brand.name} admin recovery codes for ${email}\n\n${codes.join("\n")}\n`],
                  { type: "text/plain" },
                );
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "white-portion-admin-recovery-codes.txt";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Download
            </Button>
          </div>
          <label className="flex items-start gap-2 text-xs text-paper-soft">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="mt-0.5"
            />
            I've stored these codes somewhere safe (a password manager or printed copy).
          </label>
          <Button
            type="button"
            variant="hero"
            className="w-full"
            disabled={!saved}
            onClick={() => void onChanged()}
          >
            CONTINUE TO ADMIN
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      icon={<Smartphone className="w-6 h-6" />}
      title="Set up two-step verification"
      sub="Required for every admin account. It protects bookings, orders and payments even if a password leaks."
    >
      {!setup ? (
        <div className="space-y-4 text-sm text-paper-soft">
          <ol className="list-decimal pl-5 space-y-1.5 text-xs">
            <li>
              Install an authenticator app on your phone: Google Authenticator, Microsoft
              Authenticator, 1Password or Authy.
            </li>
            <li>Press the button below, then add the key to the app.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <ErrorBox text={error} />
          <Button
            type="button"
            variant="hero"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await adminStartMfa().catch(() => null);
              setBusy(false);
              if (!r) return setError("Could not reach the server.");
              if (!r.ok) return setError(r.error);
              setSetup(r);
            }}
          >
            START SETUP
          </Button>
          <button
            type="button"
            className="w-full text-[11px] text-paper-faint hover:text-paper"
            onClick={async () => {
              await adminSignOut();
              await onChanged();
            }}
          >
            Sign out
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
              const r = await adminConfirmMfa({ data: { code: code.trim() } });
              if (!r.ok) return setError(r.error);
              setCodes(r.recoveryCodes);
            } catch {
              setError("Enter the 6-digit code from the app.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <a
            href={setup.uri}
            className="block text-center px-4 py-3 rounded border border-gold-accent/50 text-gold-accent text-xs font-bold tracking-wider hover:bg-gold-accent/10"
          >
            ON THIS PHONE? TAP TO ADD TO YOUR AUTHENTICATOR APP
          </a>
          <div>
            <p className={lbl}>Or type this key into the app ("Enter a setup key")</p>
            <p className="font-mono text-sm break-all bg-charcoal border border-rule-light rounded p-3 select-all text-paper">
              {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
            </p>
            <p className="text-[10px] text-paper-faint mt-1">Account: {email} · Type: time-based</p>
          </div>
          <div>
            <label className={lbl} htmlFor="mfa-code">
              6-digit code from the app
            </label>
            <input
              id="mfa-code"
              className={`${field} text-center tracking-[0.5em] text-lg`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <ErrorBox text={error} />
          <Button
            type="submit"
            variant="hero"
            className="w-full"
            disabled={busy || code.length !== 6}
          >
            {busy ? "CHECKING…" : "TURN ON 2FA"}
          </Button>
        </form>
      )}
    </Shell>
  );
}
