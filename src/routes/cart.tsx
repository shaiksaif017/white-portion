import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { TotalsBlock, useCartDetails } from "@/components/cart-data";
import { ProductImage, TrustRow } from "@/components/shop-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/lib/brand";
import { cart } from "@/lib/cart";
import { getShopStatus } from "@/lib/order-api";
import { lineKey, MAX_QTY } from "@/lib/order-types";
import { formatINR, KIND_LABEL } from "@/lib/shop-types";

export const Route = createFileRoute("/cart")({
  loader: () => getShopStatus(),
  head: () => ({
    meta: [{ title: `Your cart | ${brand.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: CartPage,
});

function CartPage() {
  const { settings, paymentsEnabled } = Route.useLoaderData();
  const { loading, error, rows, totals, hasProblems } = useCartDetails(settings);

  return (
    <main>
      <SiteHeader isSolid />
      <section className="page-section section-wrap bg-cream !pt-10 min-h-[60vh]">
        <Link
          to="/services-products"
          hash="products"
          className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-6"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Continue shopping
        </Link>
        <h1 className="text-4xl md:text-5xl font-display font-medium text-charcoal mb-10">
          Your cart
        </h1>

        {error && <p className="text-sm text-destructive mb-6">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your cart…</p>
        ) : error && rows.length === 0 ? null : rows.length === 0 ? (
          <div className="page-card !p-10 items-center text-center gap-4 max-w-xl">
            <ShoppingBag className="w-10 h-10 text-primary/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            <Link
              to="/services-products"
              hash="products"
              className="inline-flex px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep transition-colors"
            >
              BROWSE PRODUCTS
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <ul className="lg:col-span-2 page-card !p-0 divide-y divide-border">
              {rows.map(({ item: p, qty, problem }) => {
                const digital = p.kind === "ebook" || p.kind === "course";
                const max = Math.min(MAX_QTY, p.stock ?? MAX_QTY);
                const ref = { productId: p.productId, variantId: p.variantId };
                return (
                  <li key={lineKey(p)} className="p-5 flex gap-4">
                    <Link
                      to="/product/$slug"
                      params={{ slug: p.slug }}
                      className="w-20 h-20 shrink-0 rounded overflow-hidden border border-border"
                    >
                      <ProductImage imageId={p.imageId} alt={p.name} kind={p.kind} />
                    </Link>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex justify-between gap-3">
                        <div>
                          <Link
                            to="/product/$slug"
                            params={{ slug: p.slug }}
                            className="font-display text-lg text-charcoal hover:text-primary leading-tight"
                          >
                            {p.name}
                          </Link>
                          {p.variantName && (
                            <p className="text-xs text-charcoal">{p.variantName}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {KIND_LABEL[p.kind]} · {formatINR(p.pricePaise)} each
                            {p.sku ? ` · SKU ${p.sku}` : ""}
                          </p>
                        </div>
                        <span className="font-semibold text-charcoal whitespace-nowrap">
                          {formatINR(p.pricePaise * qty)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {!digital && (
                          <div className="inline-flex items-center border border-border rounded bg-background">
                            <button
                              type="button"
                              aria-label={`Decrease quantity of ${p.name}`}
                              onClick={() => cart.setQty(ref, qty - 1)}
                              className="p-2 hover:text-primary"
                            >
                              <Minus className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <span className="w-7 text-center text-xs font-semibold">{qty}</span>
                            <button
                              type="button"
                              aria-label={`Increase quantity of ${p.name}`}
                              onClick={() => cart.setQty(ref, qty + 1)}
                              disabled={qty >= max}
                              className="p-2 hover:text-primary disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => cart.remove(ref)}
                          className="text-[11px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" /> Remove
                        </button>
                      </div>
                      {problem && <p className="text-xs text-destructive">{problem}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="page-card !p-6 space-y-4 lg:sticky lg:top-6">
              <h2 className="text-xs font-bold tracking-widest text-primary uppercase">
                Order summary
              </h2>
              <TotalsBlock totals={totals} settings={settings} />
              {paymentsEnabled ? (
                hasProblems ? (
                  <p className="text-xs text-destructive">
                    Please fix the items marked above before checking out.
                  </p>
                ) : (
                  <Link
                    to="/checkout"
                    className="block text-center px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep transition-colors"
                  >
                    PROCEED TO CHECKOUT
                  </Link>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  Online checkout is opening soon. Message us on WhatsApp to order.
                </p>
              )}
              <TrustRow />
            </aside>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
