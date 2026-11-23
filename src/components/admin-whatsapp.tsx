// Admin > Email Notification Log > Automatic WhatsApp (Meta WhatsApp Cloud API).
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type WhatsAppSettingsView,
  adminGetWhatsAppSettings,
  adminSaveWhatsAppSettings,
  adminSendWhatsAppTest,
} from "@/lib/whatsapp-admin-api";
import { CANCEL_TEMPLATE_TEXT, CONFIRM_TEMPLATE_TEXT } from "@/lib/whatsapp-templates";

const input = "w-full p-2.5 rounded border border-border bg-background text-xs";
const label = "block text-xs font-bold text-charcoal mb-1";

export function AdminWhatsApp({ onSessionExpired }: { onSessionExpired: (msg: string) => void }) {
  const [s, setS] = useState<WhatsAppSettingsView | null>(null);
  const [token, setToken] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function fail(error: string) {
    if (/session has expired/i.test(error)) onSessionExpired(error);
    else setMsg(error);
  }

  useEffect(() => {
    adminGetWhatsAppSettings()
      .then((r) => (r.ok ? setS(r.settings) : fail(r.error)))
      .catch(() => setMsg("Could not reach the server."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminSaveWhatsAppSettings({
        data: {
          enabled: s.enabled,
          phoneNumberId: s.phoneNumberId,
          confirmTemplate: s.confirmTemplate,
          cancelTemplate: s.cancelTemplate,
          language: s.language,
          token,
        },
      });
      if (!r.ok) return fail(r.error);
      setS(r.settings);
      setToken("");
      setMsg("WhatsApp settings saved.");
    } catch (error) {
      setMsg(
        error instanceof Error && /Template|Phone number|Language/.test(error.message)
          ? "Please check the Phone number ID, template names and language code."
          : "Could not reach the server.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminSendWhatsAppTest({ data: { phone: testPhone } });
      if (!r.ok) return fail(r.error);
      setMsg(
        r.status === "SENT"
          ? "Test WhatsApp sent. Check the phone."
          : `Test ${r.status.toLowerCase()}${r.error ? `: ${r.error}` : ""}`,
      );
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!s) {
    return msg ? (
      <p className="mt-4 text-xs text-destructive">{msg}</p>
    ) : (
      <p className="mt-4 text-xs text-muted-foreground">Loading WhatsApp settings…</p>
    );
  }

  const ready = s.enabled && s.hasToken && s.phoneNumberId;

  return (
    <div className="mt-6 p-4 rounded border border-border bg-secondary/30 space-y-4">
      <div>
        <h4 className="text-sm font-bold text-charcoal">Automatic WhatsApp</h4>
        <p className="text-[11px] text-muted-foreground">
          When on, clicking <strong>Confirm</strong> or <strong>Cancel</strong> on a booking sends
          the customer a WhatsApp message automatically, together with the email. Status:{" "}
          <span className={ready ? "text-primary font-bold" : "text-destructive font-bold"}>
            {ready ? "ON" : "OFF"}
          </span>
        </p>
      </div>

      <details className="text-[11px] text-charcoal">
        <summary className="cursor-pointer font-semibold">
          One-time setup in Meta (about 30 minutes + 1–2 days for approval)
        </summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1.5 text-muted-foreground">
          <li>
            Go to <strong>business.facebook.com</strong> and create (or use) your Meta Business
            account. Verify the business when asked.
          </li>
          <li>
            At <strong>developers.facebook.com</strong> → My Apps → Create app → type{" "}
            <strong>Business</strong> → add the <strong>WhatsApp</strong> product.
          </li>
          <li>
            In WhatsApp → API Setup, add your business phone number and verify it by SMS/call. Copy
            the <strong>Phone number ID</strong> shown there.
          </li>
          <li>
            In WhatsApp Manager → Message templates, create the two templates below: category{" "}
            <strong>Utility</strong>, language <strong>English</strong>, names exactly as shown,
            body text copied exactly. Wait for &quot;Approved&quot;.
          </li>
          <li>
            Business Settings → Users → <strong>System users</strong> → Add (Admin) → Assign your
            app and WhatsApp account → <strong>Generate token</strong> with permissions{" "}
            <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>,
            expiry <strong>Never</strong>. Paste it below. (Don&apos;t use the temporary 24-hour
            token.)
          </li>
          <li>Add a payment method in WhatsApp Manager (Meta charges per message sent).</li>
        </ol>
      </details>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TemplateBox name={s.confirmTemplate} text={CONFIRM_TEMPLATE_TEXT} title="Confirmation" />
        <TemplateBox name={s.cancelTemplate} text={CANCEL_TEMPLATE_TEXT} title="Cancellation" />
      </div>

      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="wa-pnid">
            Phone number ID
          </label>
          <input
            id="wa-pnid"
            className={input}
            inputMode="numeric"
            value={s.phoneNumberId}
            onChange={(e) => setS({ ...s, phoneNumberId: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="wa-token">
            Permanent access token{" "}
            {s.hasToken && <span className="text-primary">(saved ✓, leave blank to keep)</span>}
          </label>
          <input
            id="wa-token"
            type="password"
            autoComplete="new-password"
            className={input}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="wa-ct">
            Confirmation template name
          </label>
          <input
            id="wa-ct"
            className={input}
            value={s.confirmTemplate}
            onChange={(e) => setS({ ...s, confirmTemplate: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="wa-xt">
            Cancellation template name
          </label>
          <input
            id="wa-xt"
            className={input}
            value={s.cancelTemplate}
            onChange={(e) => setS({ ...s, cancelTemplate: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="wa-lang">
            Template language code
          </label>
          <input
            id="wa-lang"
            className={input}
            value={s.language}
            onChange={(e) => setS({ ...s, language: e.target.value })}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            &quot;en&quot; for English. Use &quot;en_US&quot; if you chose English (US).
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-charcoal self-center">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => setS({ ...s, enabled: e.target.checked })}
          />
          Send WhatsApp automatically on Confirm / Cancel
        </label>
        <div className="md:col-span-2">
          <Button type="submit" variant="hero" className="text-xs" disabled={busy}>
            {busy ? "Saving…" : "Save WhatsApp settings"}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border">
        <div className="flex-1 min-w-[200px]">
          <label className={label} htmlFor="wa-test">
            Send a test confirmation to
          </label>
          <input
            id="wa-test"
            type="tel"
            placeholder="Your mobile number"
            className={input}
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          disabled={busy || !testPhone || !ready}
          onClick={() => void test()}
        >
          Send test WhatsApp
        </Button>
      </div>

      {msg && <p className="text-xs font-semibold text-charcoal whitespace-pre-wrap">{msg}</p>}
    </div>
  );
}

function TemplateBox({ name, text, title }: { name: string; text: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="p-3 rounded border border-border bg-background space-y-2">
      <div className="flex justify-between items-center gap-2">
        <p className="text-[11px] font-bold text-charcoal">
          {title} template: <code>{name}</code>
        </p>
        <button
          type="button"
          className="text-[11px] text-primary font-semibold cursor-pointer"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "Copied ✓" : "Copy text"}
        </button>
      </div>
      <pre className="text-[11px] whitespace-pre-wrap text-muted-foreground font-sans">{text}</pre>
    </div>
  );
}
