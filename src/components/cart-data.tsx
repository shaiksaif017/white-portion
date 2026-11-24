// Joins the browser cart with fresh product data from the server.
import { useEffect, useMemo, useState } from "react";

import { cart, useCart } from "@/lib/cart";
import { getCartItems } from "@/lib/order-api";
import {
  type CartItemInfo,
  type ShopSettings,
  type Totals,
  computeTotals,
  lineKey,
} from "@/lib/order-types";
import { formatINR } from "@/lib/shop-types";

export interface CartRow {
  item: CartItemInfo;
  qty: number;
  problem: string | null; // why this line can't be bought right now
}

export function useCartDetails(settings: ShopSettings) {
  const lines = useCart();
  const [items, setItems] = useState<Map<string, CartItemInfo> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linesKey = lines.map(lineKey).sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const refs = linesKey
      ? linesKey.split(",").map((k) => {
          const [p, v] = k.split(":").map(Number);
          return { productId: p!, variantId: v ? v : null, qty: 1 };
        })
      : [];
    if (refs.length === 0) {
      setItems(new Map());
      return;
    }
    getCartItems({ data: { lines: refs } })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const map = new Map(res.items.map((i) => [lineKey(i), i]));
        setItems(map);
        setError(null);
        cart.keepOnly(new Set(map.keys())); // drop items no longer sold
      })
      .catch(() => !cancelled && setError("Could not load your cart. Please refresh the page."));
    return () => {
      cancelled = true;
    };
  }, [linesKey]);

  const rows: CartRow[] = useMemo(() => {
    if (!items) return [];
    return lines.flatMap((l) => {
      const item = items.get(lineKey(l));
      if (!item) return [];
      let problem: string | null = item.problem;
      if (!problem && !item.purchasable) problem = "No longer available to order online";
      else if (!problem && item.stock !== null && l.qty > item.stock)
        problem = item.stock > 0 ? `Only ${item.stock} left in stock` : "Out of stock";
      return [{ item, qty: l.qty, problem }];
    });
  }, [lines, items]);

  const totals = computeTotals(
    rows.map((r) => ({
      unitPaise: r.item.pricePaise,
      qty: r.qty,
      kind: r.item.kind,
      gstRateBps: r.item.gstRateBps,
    })),
    settings,
  );

  return {
    loading: items === null && !error,
    error,
    rows,
    totals,
    hasProblems: rows.some((r) => r.problem),
  };
}

export function TotalsBlock({
  totals,
  settings,
  couponCode = null,
}: {
  totals: Totals;
  settings: ShopSettings;
  couponCode?: string | null;
}) {
  const remaining =
    totals.shipping && settings.freeShippingFromPaise !== null && totals.shippingPaise > 0
      ? settings.freeShippingFromPaise - (totals.subtotalPaise - totals.discountPaise)
      : 0;
  return (
    <dl className="text-sm divide-y divide-border">
      <div className="flex justify-between py-2.5">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="font-medium text-charcoal">{formatINR(totals.subtotalPaise)}</dd>
      </div>
      {totals.discountPaise > 0 && (
        <div className="flex justify-between py-2.5">
          <dt className="text-primary">Discount{couponCode ? ` (${couponCode})` : ""}</dt>
          <dd className="font-medium text-primary">−{formatINR(totals.discountPaise)}</dd>
        </div>
      )}
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
      {totals.taxPaise > 0 && (
        <p className="pt-2 text-[11px] text-muted-foreground">
          Prices include GST of {formatINR(totals.taxPaise)}.
        </p>
      )}
      {remaining > 0 && (
        <p className="pt-2.5 text-xs text-primary">
          Add {formatINR(remaining)} more for free shipping.
        </p>
      )}
    </dl>
  );
}
