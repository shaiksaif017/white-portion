import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TotalsBlock, useCartDetails } from "@/components/cart-data";
import { TrustRow } from "@/components/shop-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/lib/brand";
import { cart } from "@/lib/cart";
import { applyCoupon, confirmPayment, getShopStatus, startCheckout } from "@/lib/order-api";
import { type Totals, INDIAN_STATES, lineKey } from "@/lib/order-types";
import { formatINR } from "@/lib/shop-types";

export const Route = createFileRoute("/checkout")({
  loader: () => getShopStatus(),
  head: () => ({
    meta: [{ title: `Checkout | ${brand.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: CheckoutPage,
});

// ---- Razorpay Checkout script (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/) ----

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", fn: (e: { error?: { description?: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

type Started = Extract<Awaited<ReturnType<typeof startCheckout>>, { ok: true }>;

const input = "w-full p-3 rounded border border-border bg-background text-sm";
const label = "block text-xs font-bold text-charcoal mb-1.5";

function CheckoutPage() {
  const { settings, paymentsEnabled } = Route.useLoaderData();
  const { loading, error: loadError, rows, totals, hasProblems } = useCartDetails(settings);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    notes: "",
    acceptTerms: false,
  });
  const [busy, setBusy] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; totals: Totals; cartKey: string } | null>(
    null,
  );
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const cartKey = rows.map((r) => `${lineKey(r.item)}x${r.qty}`).join(",");
  // A coupon's totals only hold for the cart it was checked against.
  const activeCoupon = coupon && coupon.cartKey === cartKey ? coupon : null;
  const shownTotals = activeCoupon?.totals ?? totals;

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponMsg(null);
    try {
      const res = await applyCoupon({
        data: {
          code,
          lines: rows.map((r) => ({
            productId: r.item.productId,
            variantId: r.item.variantId,
            qty: r.qty,
          })),
        },
      });
      if (!res.ok) {
        setCoupon(null);
        setCouponMsg(res.error);
        return;
      }
      setCoupon({ code: res.code, totals: res.totals, cartKey });
      setCouponMsg(null);
    } catch {
      setCouponMsg("Could not check the coupon. Please try again.");
    }
  }
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef<{ key: string; data: Started } | null>(null);

  // Preload the payment script so the window opens instantly.
  useEffect(() => {
    if (paymentsEnabled) loadRazorpay().catch(() => undefined);
  }, [paymentsEnabled]);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({
        ...f,
        [k]:
          e.target instanceof HTMLInputElement && e.target.type === "checkbox"
            ? e.target.checked
            : e.target.value,
      }));

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const payload = {
        items: rows.map((r) => ({
          productId: r.item.productId,
          variantId: r.item.variantId,
          qty: r.qty,
        })),
        couponCode: activeCoupon?.code ?? null,
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: totals.shipping
          ? {
              line1: form.line1,
              line2: form.line2,
              city: form.city,
              state: form.state,
              pincode: form.pincode,
            }
          : null,
        notes: form.notes,
        acceptTerms: form.acceptTerms,
      };
      // Reuse the same order if the customer closed the payment window and retries
      // without changing anything.
      const key = JSON.stringify(payload);
      let data = started.current?.key === key ? started.current.data : null;
      if (!data) {
        const res = await startCheckout({ data: payload });
        if (!res.ok) {
          setMessage(res.error);
          setBusy(false);
          return;
        }
        data = res;
        started.current = { key, data };
      }

      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Payment window unavailable");
      const order = data;
      const rzp = new window.Razorpay({
        key: order.razorpay.keyId,
        order_id: order.razorpay.orderId,
        amount: order.razorpay.amount,
        currency: "INR",
        name: brand.name,
        description: `Order ${order.orderNumber}`,
        image: `${window.location.origin}/icon-512.png`,
        prefill: {
          name: order.customer.name,
          email: order.customer.email,
          contact: order.customer.phone,
        },
        notes: { order_number: order.orderNumber },
        theme: { color: "#4f6b3a" },
        handler: async (resp: RazorpaySuccess) => {
          setMessage("Payment received. Confirming your order…");
          const result = await confirmPayment({
            data: {
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
            },
          }).catch(() => ({ ok: false as const, error: "" }));
          // Even if confirmation is slow, the order page re-checks with Razorpay.
          if (!result.ok) console.warn("[checkout] confirm", result.error);
          cart.clear();
          started.current = null;
          void navigate({
            to: "/order/$number",
            params: { number: order.orderNumber },
            search: { t: order.token },
          });
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setMessage("Payment was not completed. You can try again whenever you're ready.");
          },
        },
      });
      rzp.on("payment.failed", (ev) => {
        setMessage(
          `Payment failed${ev.error?.description ? `: ${ev.error.description}` : ""}. No money was taken. Please try again or use another method.`,
        );
      });
      rzp.open();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main>
      <SiteHeader isSolid />
      <section className="page-section section-wrap bg-cream !pt-10 min-h-[60vh]">
        <Link
          to="/cart"
          className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-6"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Back to cart
        </Link>
        <h1 className="text-4xl md:text-5xl font-display font-medium text-charcoal mb-10">
          Checkout
        </h1>

        {!paymentsEnabled ? (
          <p className="text-sm text-muted-foreground">
            Online checkout is opening soon. Please message us on WhatsApp to order.
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your cart is empty.{" "}
            <Link
              to="/services-products"
              hash="products"
              className="text-primary font-semibold underline"
            >
              Browse products
            </Link>
          </p>
        ) : (
          <form
            onSubmit={pay}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
            noValidate={false}
          >
            <div className="lg:col-span-2 space-y-6">
              <fieldset className="page-card !p-6 space-y-4">
                <legend className="text-xs font-bold tracking-widest text-primary uppercase mb-2">
                  Your details
                </legend>
                <div>
                  <label htmlFor="co-name" className={label}>
                    Full name
                  </label>
                  <input
                    id="co-name"
                    className={input}
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    value={form.name}
                    onChange={set("name")}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="co-email" className={label}>
                      Email
                    </label>
                    <input
                      id="co-email"
                      type="email"
                      className={input}
                      required
                      maxLength={254}
                      autoComplete="email"
                      value={form.email}
                      onChange={set("email")}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      We'll send your receipt
                      {rows.some((r) => r.item.kind === "ebook") ? " and download link" : ""} here.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="co-phone" className={label}>
                      Mobile number
                    </label>
                    <input
                      id="co-phone"
                      type="tel"
                      inputMode="tel"
                      className={input}
                      required
                      autoComplete="tel"
                      placeholder="10-digit mobile"
                      value={form.phone}
                      onChange={set("phone")}
                    />
                  </div>
                </div>
              </fieldset>

              {totals.shipping && (
                <fieldset className="page-card !p-6 space-y-4">
                  <legend className="text-xs font-bold tracking-widest text-primary uppercase mb-2">
                    Delivery address
                  </legend>
                  <div>
                    <label htmlFor="co-line1" className={label}>
                      House / flat, street
                    </label>
                    <input
                      id="co-line1"
                      className={input}
                      required
                      minLength={3}
                      maxLength={200}
                      autoComplete="address-line1"
                      value={form.line1}
                      onChange={set("line1")}
                    />
                  </div>
                  <div>
                    <label htmlFor="co-line2" className={label}>
                      Area, landmark (optional)
                    </label>
                    <input
                      id="co-line2"
                      className={input}
                      maxLength={200}
                      autoComplete="address-line2"
                      value={form.line2}
                      onChange={set("line2")}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="co-city" className={label}>
                        City
                      </label>
                      <input
                        id="co-city"
                        className={input}
                        required
                        maxLength={80}
                        autoComplete="address-level2"
                        value={form.city}
                        onChange={set("city")}
                      />
                    </div>
                    <div>
                      <label htmlFor="co-state" className={label}>
                        State
                      </label>
                      <select
                        id="co-state"
                        className={input}
                        required
                        autoComplete="address-level1"
                        value={form.state}
                        onChange={set("state")}
                      >
                        <option value="">Choose…</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="co-pin" className={label}>
                        PIN code
                      </label>
                      <input
                        id="co-pin"
                        className={input}
                        required
                        inputMode="numeric"
                        pattern="[1-9][0-9]{5}"
                        maxLength={6}
                        autoComplete="postal-code"
                        value={form.pincode}
                        onChange={set("pincode")}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    We currently deliver within India only.
                  </p>
                </fieldset>
              )}

              <fieldset className="page-card !p-6 space-y-3">
                <legend className="text-xs font-bold tracking-widest text-primary uppercase mb-2">
                  Order note (optional)
                </legend>
                <textarea
                  id="co-notes"
                  aria-label="Order note"
                  className={`${input} min-h-20`}
                  maxLength={1000}
                  value={form.notes}
                  onChange={set("notes")}
                />
              </fieldset>
            </div>

            <aside className="page-card !p-6 space-y-4 lg:sticky lg:top-6">
              <h2 className="text-xs font-bold tracking-widest text-primary uppercase">
                Your order
              </h2>
              <ul className="text-sm space-y-2">
                {rows.map((r) => (
                  <li key={lineKey(r.item)} className="flex justify-between gap-3">
                    <span className="text-charcoal">
                      {r.qty} × {r.item.name}
                      {r.item.variantName && (
                        <span className="text-muted-foreground"> ({r.item.variantName})</span>
                      )}
                    </span>
                    <span className="whitespace-nowrap">
                      {formatINR(r.item.pricePaise * r.qty)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <label htmlFor="co-coupon" className="sr-only">
                    Coupon code
                  </label>
                  <input
                    id="co-coupon"
                    className="flex-1 min-w-0 p-2.5 rounded border border-border bg-background text-xs uppercase"
                    placeholder="Coupon code"
                    autoComplete="off"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleApplyCoupon();
                      }
                    }}
                  />
                  {activeCoupon ? (
                    <button
                      type="button"
                      className="px-3 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setCoupon(null);
                        setCouponInput("");
                      }}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="px-3 rounded border border-primary text-primary text-[11px] font-bold hover:bg-primary hover:text-primary-foreground"
                      onClick={() => void handleApplyCoupon()}
                    >
                      APPLY
                    </button>
                  )}
                </div>
                {couponMsg && (
                  <p className="text-[11px] text-destructive" role="alert">
                    {couponMsg}
                  </p>
                )}
                {activeCoupon && (
                  <p className="text-[11px] text-primary" role="status">
                    Coupon {activeCoupon.code} applied.
                  </p>
                )}
                {coupon && !activeCoupon && (
                  <p className="text-[11px] text-muted-foreground">
                    Your cart changed. Apply the coupon again.
                  </p>
                )}
              </div>
              <TotalsBlock
                totals={shownTotals}
                settings={settings}
                couponCode={activeCoupon?.code ?? null}
              />
              <label className="flex items-start gap-2 text-xs text-charcoal">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5"
                  checked={form.acceptTerms}
                  onChange={set("acceptTerms")}
                />
                <span>I confirm my details are correct and I'd like to place this order.</span>
              </label>
              {hasProblems ? (
                <p className="text-xs text-destructive">
                  Some items need attention.{" "}
                  <Link to="/cart" className="underline">
                    Review your cart
                  </Link>
                  .
                </p>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex justify-center items-center gap-2 px-5 py-3.5 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep transition-colors disabled:opacity-60"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  {busy ? "PLEASE WAIT…" : `PAY ${formatINR(shownTotals.totalPaise)}`}
                </button>
              )}
              {message && (
                <p className="text-xs text-charcoal bg-secondary rounded p-3" role="status">
                  {message}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Payments are processed securely by Razorpay (UPI, cards, net banking, wallets). We
                never see your card details.
              </p>
              <TrustRow />
            </aside>
          </form>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
