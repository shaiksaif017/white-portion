// Admin > Products > Sample data: load or remove demo products, coupons and orders.
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { adminLoadSampleData, adminRemoveSampleData, adminSampleStatus } from "@/lib/shop-api";

type Counts = { products: number; orders: number; coupons: number };

export function AdminSampleData({
  fail,
  onChanged,
}: {
  fail: (msg: string) => void;
  onChanged: (msg: string) => void;
}) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const r = await adminSampleStatus();
      if (r.ok) setCounts(r.counts);
      else fail(r.error);
    } catch {
      fail("Could not reach the server.");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  async function run(action: "load" | "remove") {
    if (
      action === "remove" &&
      !confirm(
        "Remove ALL sample products, sample coupons and sample orders? Your real products and orders are not touched.",
      )
    )
      return;
    setBusy(true);
    try {
      const r = action === "load" ? await adminLoadSampleData() : await adminRemoveSampleData();
      if (!r.ok) return fail(r.error);
      onChanged(
        action === "load"
          ? `Loaded ${r.products} sample products, ${r.coupons} coupons and ${r.orders} orders.`
          : `Removed ${r.products} sample products, ${r.coupons} coupons and ${r.orders} orders.`,
      );
      await refresh();
    } catch {
      fail("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const loaded = counts && counts.products + counts.orders + counts.coupons > 0;

  return (
    <div className="p-5 rounded border border-gold-accent/60 bg-gold-accent/10 space-y-3 text-xs">
      <h4 className="text-sm font-bold text-charcoal">Sample data for testing</h4>
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        Adds about 14 demo products across all four categories (with options, SKUs, stock levels,
        e-book files and free previews), 2 coupon codes (<code>SAMPLE10</code>,{" "}
        <code>SAMPLEWELCOME</code>) and 7 past orders in different states. Everything is labelled{" "}
        <strong>SAMPLE</strong> on the website and is <strong>visible to visitors</strong> while
        loaded, so remove it before you start selling. No emails are sent for sample orders.
      </p>
      {counts && (
        <p className="font-semibold text-charcoal">
          Currently loaded: {counts.products} products · {counts.coupons} coupons · {counts.orders}{" "}
          orders
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="hero"
          className="text-xs"
          disabled={busy || Boolean(loaded)}
          onClick={() => void run("load")}
        >
          {busy ? "Working…" : "Load sample data"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          disabled={busy || !loaded}
          onClick={() => void run("remove")}
        >
          Remove all sample data
        </Button>
      </div>
    </div>
  );
}
