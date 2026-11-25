// Admin > Orders: list and process orders, plus Razorpay keys and shipping settings.
import { CreditCard, Download, RefreshCw, Save, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type PaymentSettingsView,
  adminCheckPayment,
  adminExportOrdersCsv,
  adminGetOrders,
  adminGetPaymentSettings,
  adminMarkRefunded,
  adminSaveRazorpayKeys,
  adminSaveShopSettings,
  adminSaveWebhookSecret,
  adminUpdateOrder,
} from "@/lib/order-api";
import {
  type FulfilmentStatus,
  type OrderRecord,
  formatAddress,
  FULFILMENT_LABEL,
  FULFILMENT_STATUSES,
  PAYMENT_LABEL,
} from "@/lib/order-types";
import { formatINR } from "@/lib/shop-types";

const input = "w-full p-2.5 rounded border border-border bg-background text-xs";
const label = "block text-xs font-bold text-charcoal mb-1";

type View = "paid" | "unpaid" | "all";

export function AdminOrders({
  onSessionExpired,
  canSettings = true,
  canRefund = true,
}: {
  onSessionExpired: (msg: string) => void;
  canSettings?: boolean; // the server checks again; this only hides buttons
  canRefund?: boolean;
}) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("paid");
  const [status, setStatus] = useState<FulfilmentStatus | "">("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  function fail(msg: string) {
    if (/session has expired/i.test(msg)) onSessionExpired(msg);
    else setError(msg);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await adminGetOrders();
      if (!res.ok) return fail(res.error);
      setOrders(res.orders);
      setError(null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (view === "paid" && o.paymentStatus !== "paid" && o.paymentStatus !== "refunded")
        return false;
      if (view === "unpaid" && (o.paymentStatus === "paid" || o.paymentStatus === "refunded"))
        return false;
      if (status && o.fulfilmentStatus !== status) return false;
      if (!q) return true;
      return [o.orderNumber, o.name, o.email, o.phone].some((v) => v.toLowerCase().includes(q));
    });
  }, [orders, view, status, search]);

  const paid = orders.filter((o) => o.paymentStatus === "paid");
  const toProcess = paid.filter(
    (o) => o.fulfilmentStatus === "new" || o.fulfilmentStatus === "processing",
  );
  const revenue = paid.reduce((n, o) => n + o.totalPaise, 0);

  function replace(o: OrderRecord) {
    setOrders((list) => list.map((x) => (x.id === o.id ? o : x)));
  }

  async function exportCsv() {
    try {
      const res = await adminExportOrdersCsv();
      if (!res.ok) return fail(res.error);
      const blob = new Blob(["﻿" + res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wpw-orders-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not reach the server.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-display font-medium text-charcoal">Orders</h3>
          <p className="text-xs text-muted-foreground">
            {toProcess.length} to process · {paid.length} paid orders · {formatINR(revenue)}{" "}
            received
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSettings && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSettings((s) => !s)}
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Payment settings
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void exportCsv()}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
          </Button>
        </div>
      </div>

      {showSettings && <PaymentSettings onFail={fail} />}

      {error && (
        <div className="p-3 rounded border border-destructive/40 bg-destructive/10 text-xs">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="inline-flex rounded border border-border overflow-hidden text-xs font-semibold">
          {(["paid", "unpaid", "all"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-2 ${view === v ? "bg-primary text-primary-foreground" : "bg-background text-charcoal"}`}
            >
              {v === "paid" ? "Paid" : v === "unpaid" ? "Unpaid / abandoned" : "All"}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by status"
          className={`${input} md:w-48`}
          value={status}
          onChange={(e) => setStatus(e.target.value as FulfilmentStatus | "")}
        >
          <option value="">All statuses</option>
          {FULFILMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FULFILMENT_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Search orders"
          placeholder="Search order no., name, email, phone"
          className={`${input} md:flex-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading orders…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          {orders.length === 0 ? "No orders yet." : "No orders match these filters."}
        </p>
      ) : (
        <div className="overflow-x-auto border border-border rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Items</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  open={openId === o.id}
                  onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                  onChange={replace}
                  onFail={fail}
                  canRefund={canRefund}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function paymentBadge(o: OrderRecord) {
  const cls =
    o.paymentStatus === "paid"
      ? "bg-primary/15 text-primary"
      : o.paymentStatus === "refunded"
        ? "bg-secondary text-muted-foreground"
        : "bg-destructive/10 text-destructive";
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>
      {PAYMENT_LABEL[o.paymentStatus]}
    </span>
  );
}

function OrderRow({
  order: o,
  open,
  onToggle,
  onChange,
  onFail,
  canRefund,
}: {
  order: OrderRecord;
  open: boolean;
  onToggle: () => void;
  onChange: (o: OrderRecord) => void;
  onFail: (msg: string) => void;
  canRefund: boolean;
}) {
  const [form, setForm] = useState({
    fulfilmentStatus: o.fulfilmentStatus,
    trackingInfo: o.trackingInfo,
    adminNotes: o.adminNotes,
    notifyCustomer: true,
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const hasShipping = o.address !== null;

  useEffect(() => {
    setForm((f) => ({
      ...f,
      fulfilmentStatus: o.fulfilmentStatus,
      trackingInfo: o.trackingInfo,
      adminNotes: o.adminNotes,
    }));
  }, [o.fulfilmentStatus, o.trackingInfo, o.adminNotes]);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const statusChanged = form.fulfilmentStatus !== o.fulfilmentStatus;
      const res = await adminUpdateOrder({
        data: { id: o.id, ...form, notifyCustomer: form.notifyCustomer && statusChanged },
      });
      if (!res.ok) return onFail(res.error);
      onChange(res.order);
      setNote(
        res.emailed === "SENT"
          ? "Saved. Customer emailed."
          : res.emailed
            ? `Saved. Email ${res.emailed.toLowerCase()} (see Email Notification Log).`
            : "Saved.",
      );
    } catch {
      onFail("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function checkPayment() {
    setBusy(true);
    setNote(null);
    try {
      const res = await adminCheckPayment({ data: { id: o.id } });
      if (!res.ok) return onFail(res.error);
      onChange(res.order);
      setNote(
        res.order.paymentStatus === "paid"
          ? "Payment found. Order marked paid."
          : "No successful payment on Razorpay for this order.",
      );
    } catch {
      onFail("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function markRefunded() {
    if (
      !window.confirm(
        `Mark ${o.orderNumber} as refunded? Issue the refund itself in your Razorpay dashboard.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await adminMarkRefunded({ data: { id: o.id } });
      if (!res.ok) return onFail(res.error);
      onChange({ ...o, paymentStatus: "refunded" });
    } catch {
      onFail("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="hover:bg-secondary/50 cursor-pointer" onClick={onToggle}>
        <td className="p-3 font-bold text-charcoal">
          <button type="button" aria-expanded={open} className="underline-offset-2 hover:underline">
            {o.orderNumber}
          </button>
        </td>
        <td className="p-3 whitespace-nowrap">
          {new Date(o.createdAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </td>
        <td className="p-3">
          <div className="font-semibold text-charcoal">{o.name}</div>
          <div className="text-muted-foreground">{o.phone}</div>
        </td>
        <td className="p-3">
          {o.items.reduce((n, i) => n + i.qty, 0)} item(s)
          {hasShipping && (
            <Truck
              className="inline w-3 h-3 ml-1.5 text-muted-foreground"
              aria-label="Needs shipping"
            />
          )}
        </td>
        <td className="p-3 text-right font-semibold whitespace-nowrap">
          {formatINR(o.totalPaise)}
        </td>
        <td className="p-3">{paymentBadge(o)}</td>
        <td className="p-3">{FULFILMENT_LABEL[o.fulfilmentStatus]}</td>
      </tr>
      {open && (
        <tr className="bg-secondary/30">
          <td colSpan={7} className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-bold text-charcoal">Items</h4>
                <ul className="space-y-1">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span>
                        {i.qty} × {i.name}
                        {i.variantName && <> ({i.variantName})</>}
                        {i.sku && <span className="text-muted-foreground"> · {i.sku}</span>}
                      </span>
                      <span>{formatINR(i.unitPaise * i.qty)}</span>
                    </li>
                  ))}
                  {o.discountPaise > 0 && (
                    <li className="flex justify-between gap-3 text-primary border-t border-border pt-1">
                      <span>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</span>
                      <span>−{formatINR(o.discountPaise)}</span>
                    </li>
                  )}
                  <li className="flex justify-between gap-3 text-muted-foreground border-t border-border pt-1">
                    <span>Shipping</span>
                    <span>{formatINR(o.shippingPaise)}</span>
                  </li>
                  <li className="flex justify-between gap-3 font-bold">
                    <span>Total</span>
                    <span>{formatINR(o.totalPaise)}</span>
                  </li>
                  {o.taxPaise > 0 && (
                    <li className="text-muted-foreground">Includes GST {formatINR(o.taxPaise)}</li>
                  )}
                </ul>
                <p className="text-muted-foreground">
                  Razorpay payment: {o.razorpayPaymentId ?? "—"}
                  {o.paidAt && <> · paid {new Date(o.paidAt).toLocaleString("en-IN")}</>}
                </p>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-charcoal">Customer</h4>
                <p>
                  {o.name}
                  <br />
                  <a className="text-primary" href={`mailto:${o.email}`}>
                    {o.email}
                  </a>
                  <br />
                  <a className="text-primary" href={`tel:${o.phone}`}>
                    {o.phone}
                  </a>
                </p>
                {o.address && <p className="whitespace-pre-line">{formatAddress(o.address)}</p>}
                {o.notes && (
                  <p className="p-2 rounded bg-background border border-border">
                    <strong>Note:</strong> {o.notes}
                  </p>
                )}
              </div>
              <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                {o.paymentStatus === "pending" ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">
                      This order hasn't been paid. Most are abandoned checkouts. If the customer
                      says they paid, check Razorpay:
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void checkPayment()}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Check payment
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={label} htmlFor={`st-${o.id}`}>
                        Status
                      </label>
                      <select
                        id={`st-${o.id}`}
                        className={input}
                        value={form.fulfilmentStatus}
                        onChange={(e) =>
                          setForm({ ...form, fulfilmentStatus: e.target.value as FulfilmentStatus })
                        }
                      >
                        {FULFILMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {FULFILMENT_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {hasShipping && (
                      <div>
                        <label className={label} htmlFor={`tr-${o.id}`}>
                          Tracking (courier + number or link)
                        </label>
                        <input
                          id={`tr-${o.id}`}
                          className={input}
                          maxLength={500}
                          value={form.trackingInfo}
                          onChange={(e) => setForm({ ...form, trackingInfo: e.target.value })}
                        />
                      </div>
                    )}
                    <div>
                      <label className={label} htmlFor={`an-${o.id}`}>
                        Private notes
                      </label>
                      <textarea
                        id={`an-${o.id}`}
                        className={`${input} min-h-16`}
                        maxLength={5000}
                        value={form.adminNotes}
                        onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
                      />
                    </div>
                    {o.paymentStatus === "paid" && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.notifyCustomer}
                          onChange={(e) => setForm({ ...form, notifyCustomer: e.target.checked })}
                        />
                        Email the customer when the status changes
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
                        <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                      </Button>
                      {o.paymentStatus === "paid" && canRefund && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void markRefunded()}
                        >
                          Mark refunded
                        </Button>
                      )}
                    </div>
                  </>
                )}
                {note && <p className="text-primary font-semibold">{note}</p>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PaymentSettings({ onFail }: { onFail: (msg: string) => void }) {
  const [s, setS] = useState<PaymentSettingsView | null>(null);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhook, setWebhook] = useState("");
  const [fee, setFee] = useState("");
  const [freeFrom, setFreeFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function apply(v: PaymentSettingsView) {
    setS(v);
    setFee(String(v.shop.shippingFeePaise / 100));
    setFreeFrom(
      v.shop.freeShippingFromPaise === null ? "" : String(v.shop.freeShippingFromPaise / 100),
    );
  }

  useEffect(() => {
    adminGetPaymentSettings()
      .then((r) => (r.ok ? apply(r.settings) : onFail(r.error)))
      .catch(() => onFail("Could not reach the server."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  async function run(
    fn: () => Promise<{ ok: true; settings: PaymentSettingsView } | { ok: false; error: string }>,
    ok: string,
  ) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (!r.ok) {
        if (/session has expired/i.test(r.error)) onFail(r.error);
        else setMsg(r.error);
        return false;
      }
      apply(r.settings);
      setMsg(ok);
      return true;
    } catch (e) {
      setMsg(
        e instanceof Error && e.message
          ? "Please check the values and try again."
          : "Could not reach the server.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!s) return <p className="text-xs text-muted-foreground">Loading payment settings…</p>;

  return (
    <div className="border border-border rounded p-5 space-y-6 bg-background">
      <div className="space-y-1">
        <h4 className="font-bold text-sm text-charcoal">Razorpay</h4>
        <p className="text-xs">
          {s.keyIdMasked ? (
            <>
              Connected with <code>{s.keyIdMasked}</code>{" "}
              <span
                className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold ${s.mode === "live" ? "bg-primary/15 text-primary" : "bg-gold-accent/20 text-charcoal"}`}
              >
                {s.mode === "live" ? "LIVE: real payments" : "TEST MODE: no real money"}
              </span>
            </>
          ) : (
            <span className="text-destructive font-semibold">
              Not connected. Customers see "checkout opening soon".
            </span>
          )}
        </p>
      </div>

      <form
        className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              () => adminSaveRazorpayKeys({ data: { keyId, keySecret } }),
              "Keys checked with Razorpay and saved.",
            )
          ) {
            setKeyId("");
            setKeySecret("");
          }
        }}
      >
        <div>
          <label className={label} htmlFor="rzp-id">
            Key ID
          </label>
          <input
            id="rzp-id"
            className={input}
            placeholder="rzp_test_…"
            autoComplete="off"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="rzp-secret">
            Key Secret
          </label>
          <input
            id="rzp-secret"
            type="password"
            className={input}
            autoComplete="new-password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={busy || !keyId || !keySecret}>
          {s.keyIdMasked ? "Replace keys" : "Save & test keys"}
        </Button>
        <p className="md:col-span-3 text-[11px] text-muted-foreground">
          Razorpay Dashboard → Account & Settings → API Keys. Start with Test Mode keys; switch to
          Live keys after your account is activated. The secret is stored encrypted and never shown
          again.
        </p>
      </form>

      <form
        className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              () => adminSaveWebhookSecret({ data: { secret: webhook } }),
              "Webhook secret saved.",
            )
          )
            setWebhook("");
        }}
      >
        <div className="md:col-span-2">
          <label className={label} htmlFor="rzp-wh">
            Webhook secret {s.hasWebhookSecret && <span className="text-primary">(saved ✓)</span>}
          </label>
          <input
            id="rzp-wh"
            type="password"
            className={input}
            autoComplete="new-password"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={busy || webhook.length < 6}>
          Save webhook secret
        </Button>
        <p className="md:col-span-3 text-[11px] text-muted-foreground">
          Recommended. Razorpay Dashboard → Webhooks → Add: URL{" "}
          <code className="select-all">{s.webhookUrl}</code>, choose any secret (enter the same one
          here), events <code>payment.captured</code> and <code>order.paid</code>. This confirms
          orders even if a customer closes the page right after paying.
        </p>
      </form>

      <form
        className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () =>
              adminSaveShopSettings({
                data: {
                  shippingFeeRupees: Number(fee || 0),
                  freeShippingFromRupees: freeFrom.trim() === "" ? null : Number(freeFrom),
                },
              }),
            "Shipping settings saved.",
          );
        }}
      >
        <div>
          <label className={label} htmlFor="ship-fee">
            Shipping fee (₹)
          </label>
          <input
            id="ship-fee"
            type="number"
            min="0"
            step="1"
            className={input}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="ship-free">
            Free shipping from (₹, blank = never)
          </label>
          <input
            id="ship-free"
            type="number"
            min="0"
            step="1"
            className={input}
            value={freeFrom}
            onChange={(e) => setFreeFrom(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={busy}>
          Save shipping
        </Button>
        <p className="md:col-span-3 text-[11px] text-muted-foreground">
          Applies only to orders with shipped items (supplements, healthcare). E-books and courses
          never pay shipping.
        </p>
      </form>

      {msg && <p className="text-xs font-semibold text-charcoal">{msg}</p>}
    </div>
  );
}
