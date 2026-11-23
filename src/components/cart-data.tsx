// Joins the browser cart with fresh product data from the server.
import { useEffect, useMemo, useState } from "react";

import { cart, useCart } from "@/lib/cart";
import { getCartProducts } from "@/lib/order-api";
import { type CartProduct, type ShopSettings, computeTotals } from "@/lib/order-types";
import { formatINR } from "@/lib/shop-types";

export interface CartRow {
  product: CartProduct;
  qty: number;
  problem: string | null; // why this line can't be bought right now
}

export function useCartDetails(settings: ShopSettings) {
  const lines = useCart();
  const [products, setProducts] = useState<Map<number, CartProduct> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idsKey = lines
    .map((l) => l.productId)
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split(",").map(Number) : [];
    if (ids.length === 0) {
      setProducts(new Map());
      return;
    }
    getCartProducts({ data: { ids } })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const map = new Map(res.products.map((p) => [p.id, p]));
        setProducts(map);
        setError(null);
        cart.keepOnly(new Set(map.keys())); // drop items no longer sold
      })
      .catch(() => !cancelled && setError("Could not load your cart. Please refresh the page."));
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const rows: CartRow[] = useMemo(() => {
    if (!products) return [];
    return lines.flatMap((l) => {
      const product = products.get(l.productId);
      if (!product) return [];
      let problem: string | null = null;
      if (!product.purchasable) problem = "No longer available to order online";
      else if (product.stock !== null && l.qty > product.stock)
        problem = `Only ${product.stock} left in stock`;
      return [{ product, qty: l.qty, problem }];
    });
  }, [lines, products]);

  const totals = computeTotals(
    rows.map((r) => ({ unitPaise: r.product.pricePaise, qty: r.qty, kind: r.product.kind })),
    settings,
  );

  return {
    loading: products === null && !error,
    error,
    rows,
    totals,
    hasProblems: rows.some((r) => r.problem),
  };
}

export function TotalsBlock({
  totals,
  settings,
}: {
  totals: ReturnType<typeof computeTotals>;
  settings: ShopSettings;
}) {
  const remaining =
    totals.shipping && settings.freeShippingFromPaise !== null && totals.shippingPaise > 0
      ? settings.freeShippingFromPaise - totals.subtotalPaise
      : 0;
  return (
    <dl className="text-sm divide-y divide-border">
      <div className="flex justify-between py-2.5">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="font-medium text-charcoal">{formatINR(totals.subtotalPaise)}</dd>
      </div>
      {totals.shipping && (
        <div className="flex justify-between py-2.5">
          <dt className="text-muted-foreground">Shipping</dt>
          <dd className="font-medium text-charcoal">
            {totals.shippingPaise ? formatINR(totals.shippingPaise) : "Free"}
          </dd>
        </div>
      )}
      <div className="flex justify-between py-3">
        <dt className="font-bold text-charcoal">Total</dt>
        <dd className="font-bold text-charcoal text-lg">{formatINR(totals.totalPaise)}</dd>
      </div>
      {remaining > 0 && (
        <p className="pt-2.5 text-xs text-primary">
          Add {formatINR(remaining)} more for free shipping.
        </p>
      )}
    </dl>
  );
}
