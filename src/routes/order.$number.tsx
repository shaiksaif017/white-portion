import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { CheckCircle2, Clock, Download, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/lib/brand";
import { getCustomerOrder } from "@/lib/order-api";
import { formatAddress, FULFILMENT_LABEL, PAYMENT_LABEL } from "@/lib/order-types";
import { formatINR, KIND_LABEL } from "@/lib/shop-types";
import { whatsappUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/order/$number")({
  validateSearch: z.object({ t: z.string().catch("") }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ params, deps }) => {
    if (!/^WP-[A-Z0-9]{6}$/.test(params.number) || !/^[a-f0-9]{48}$/.test(deps.t)) {
      return { order: null };
    }
    return getCustomerOrder({ data: { number: params.number, token: deps.t } });
  },
  head: () => ({
    meta: [{ title: `Your order | ${brand.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { order } = Route.useLoaderData();
  const { t } = Route.useSearch();
  const router = useRouter();
  const [checks, setChecks] = useState(0);

  // While the payment is being confirmed, re-check every few seconds (about 1 minute).
  const pending = order?.paymentStatus === "pending";
  useEffect(() => {
    if (!pending || checks >= 15) return;
    const id = window.setTimeout(() => {
      setChecks((c) => c + 1);
      void router.invalidate();
    }, 4000);
    return () => window.clearTimeout(id);
  }, [pending, checks, router]);

  return (
    <main>
      <SiteHeader isSolid />
      <section className="page-section section-wrap bg-cream !pt-10 min-h-[60vh]">
        {!order ? (
          <div className="max-w-xl space-y-4">
            <h1 className="text-4xl font-display font-medium text-charcoal">Order not found</h1>
            <p className="text-sm text-muted-foreground">
              Please use the link from your order confirmation email. If you need help, message us
              on WhatsApp with your order number.
            </p>
            <a
              href={whatsappUrl(`Hello ${brand.name}, I need help finding my order.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" /> CONTACT US
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-3">
                {order.paymentStatus === "paid" ? (
                  <CheckCircle2 className="w-10 h-10 text-primary" aria-hidden="true" />
                ) : (
                  <Clock className="w-10 h-10 text-primary/70" aria-hidden="true" />
                )}
                <h1 className="text-4xl md:text-5xl font-display font-medium text-charcoal">
                  {order.paymentStatus === "paid"
                    ? `Thank you, ${order.name.split(" ")[0]}!`
                    : order.paymentStatus === "pending"
                      ? "Confirming your payment…"
                      : PAYMENT_LABEL[order.paymentStatus]}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Order <strong className="text-charcoal">{order.orderNumber}</strong>
                  {order.paymentStatus === "paid" &&
                    ` · A confirmation has been sent to ${order.email}.`}
                </p>
                {pending && (
                  <p className="text-sm text-charcoal bg-secondary rounded p-3 max-w-xl">
                    {checks >= 15
                      ? "We haven't received confirmation from the payment provider yet. If money was taken from your account, don't worry: your order will update automatically. Contact us if it doesn't within an hour."
                      : "This usually takes a few seconds. Please keep this page open."}
                  </p>
                )}
              </div>

              <ul className="page-card !p-0 divide-y divide-border">
                {order.items.map((i) => (
                  <li key={i.id} className="p-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-lg text-charcoal leading-tight">
                        {i.qty} × {i.name}
                        {i.variantName && (
                          <span className="text-base text-muted-foreground">
                            {" "}
                            ({i.variantName})
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{KIND_LABEL[i.kind]}</p>
                      {order.paymentStatus === "paid" && i.kind === "course" && (
                        <p className="text-xs mt-1">
                          {i.productSlug ? (
                            <a
                              href={`/account/login?redirect=${encodeURIComponent(`/learn/${i.productSlug}`)}`}
                              className="font-semibold text-primary underline underline-offset-4"
                            >
                              Start the course
                            </a>
                          ) : (
                            <span className="text-primary">Your course is in your account.</span>
                          )}{" "}
                          <span className="text-muted-foreground">(log in with {order.email})</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {order.paymentStatus === "paid" && i.hasDownload && (
                        <a
                          href={`/api/download?o=${encodeURIComponent(order.orderNumber)}&t=${encodeURIComponent(t)}&i=${i.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-[11px] font-bold tracking-wider hover:bg-olive-deep"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" /> DOWNLOAD
                        </a>
                      )}
                      <span className="font-semibold text-charcoal">
                        {formatINR(i.unitPaise * i.qty)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {order.paymentStatus === "paid" && order.items.some((i) => i.hasDownload) && (
                <p className="text-[11px] text-muted-foreground">
                  Keep your confirmation email: its link brings you back here to download again.
                </p>
              )}
            </div>

            <aside className="page-card !p-6 space-y-5">
              <div>
                <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-3">
                  Summary
                </h2>
                <dl className="text-sm divide-y divide-border">
                  <Row k="Payment" v={PAYMENT_LABEL[order.paymentStatus]} />
                  {order.paymentStatus === "paid" && (
                    <Row k="Order status" v={FULFILMENT_LABEL[order.fulfilmentStatus]} />
                  )}
                  <Row k="Subtotal" v={formatINR(order.subtotalPaise)} />
                  {order.discountPaise > 0 && (
                    <Row
                      k={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                      v={`−${formatINR(order.discountPaise)}`}
                    />
                  )}
                  {order.address && (
                    <Row
                      k="Shipping"
                      v={order.shippingPaise ? formatINR(order.shippingPaise) : "Free"}
                    />
                  )}
                  <Row k="Total" v={formatINR(order.totalPaise)} bold />
                </dl>
                {order.taxPaise > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Includes GST of {formatINR(order.taxPaise)}.
                  </p>
                )}
              </div>
              {order.trackingInfo && (
                <div>
                  <h3 className="text-xs font-bold text-charcoal mb-1">Tracking</h3>
                  <p className="text-sm whitespace-pre-line">{order.trackingInfo}</p>
                </div>
              )}
              {order.address && (
                <div>
                  <h3 className="text-xs font-bold text-charcoal mb-1">Delivering to</h3>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {order.name}
                    {"\n"}
                    {formatAddress(order.address)}
                  </p>
                </div>
              )}
              <a
                href={whatsappUrl(`Hello ${brand.name}, regarding my order ${order.orderNumber}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-primary"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" /> QUESTIONS? WHATSAPP US
              </a>
              <Link
                to="/services-products"
                hash="products"
                className="block text-[11px] text-muted-foreground hover:text-primary"
              >
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}

function Row({ k, v, bold = false }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-2.5 gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={bold ? "font-bold text-charcoal" : "font-medium text-charcoal"}>{v}</dd>
    </div>
  );
}
