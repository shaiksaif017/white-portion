// Search, sort, in-stock and price filters for product listings. The values live in the
// page address (?q=&sort=&stock=1&min=&max=) so filtered views can be shared and bookmarked.
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { type ProductSort, PRODUCT_SORTS, SORT_LABEL } from "@/lib/shop-types";

export const productSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  sort: z
    .enum(PRODUCT_SORTS as [ProductSort, ...ProductSort[]])
    .optional()
    .catch(undefined),
  stock: z.literal(1).optional().catch(undefined),
  min: z.number().min(0).max(10_000_000).optional().catch(undefined),
  max: z.number().min(0).max(10_000_000).optional().catch(undefined),
});
export type ProductSearch = z.infer<typeof productSearchSchema>;

// Converts page-address values into the server's query shape.
export function toProductQuery(s: ProductSearch) {
  return {
    ...(s.q ? { q: s.q } : {}),
    ...(s.sort ? { sort: s.sort } : {}),
    ...(s.stock ? { inStock: true } : {}),
    ...(s.min !== undefined ? { minRupees: s.min } : {}),
    ...(s.max !== undefined ? { maxRupees: s.max } : {}),
  };
}

export function hasActiveFilters(s: ProductSearch): boolean {
  return Boolean(s.q || s.stock || s.min !== undefined || s.max !== undefined);
}

const input = "p-2.5 rounded border border-border bg-background text-xs text-charcoal";

export function ProductFilters({
  value,
  onChange,
  resultCount,
  showStockFilter = true,
}: {
  value: ProductSearch;
  onChange: (next: ProductSearch) => void;
  resultCount: number;
  showStockFilter?: boolean;
}) {
  const [q, setQ] = useState(value.q ?? "");
  const [min, setMin] = useState(value.min?.toString() ?? "");
  const [max, setMax] = useState(value.max?.toString() ?? "");

  // Keep the boxes in step when the address changes (back button, "clear").
  useEffect(() => setQ(value.q ?? ""), [value.q]);
  useEffect(() => setMin(value.min?.toString() ?? ""), [value.min]);
  useEffect(() => setMax(value.max?.toString() ?? ""), [value.max]);

  function num(v: string): number | undefined {
    const n = Number(v);
    return v.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : n;
  }

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    onChange({ ...value, q: q.trim() || undefined, min: num(min), max: num(max) });
  }

  return (
    <form
      onSubmit={apply}
      role="search"
      aria-label="Search and filter products"
      className="mb-8 flex flex-col lg:flex-row lg:items-end gap-3"
    >
      <div className="relative flex-1 min-w-0">
        <label htmlFor="pf-q" className="sr-only">
          Search products
        </label>
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="pf-q"
          type="search"
          placeholder="Search by name, flavour or SKU"
          className={`${input} w-full pl-9`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="pf-min" className="text-[11px] text-muted-foreground">
            ₹
          </label>
          <input
            id="pf-min"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Min"
            aria-label="Minimum price in rupees"
            className={`${input} w-20`}
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
          <span className="text-muted-foreground text-xs">–</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Max"
            aria-label="Maximum price in rupees"
            className={`${input} w-20`}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
        {showStockFilter && (
          <label className="flex items-center gap-2 text-xs text-charcoal py-2.5">
            <input
              type="checkbox"
              checked={Boolean(value.stock)}
              onChange={(e) => onChange({ ...value, stock: e.target.checked ? 1 : undefined })}
            />
            Available to buy
          </label>
        )}
        <select
          aria-label="Sort products"
          className={input}
          value={value.sort ?? "featured"}
          onChange={(e) =>
            onChange({
              ...value,
              sort: e.target.value === "featured" ? undefined : (e.target.value as ProductSort),
            })
          }
        >
          {PRODUCT_SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep transition-colors"
        >
          APPLY
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground lg:hidden" aria-live="polite">
        {resultCount} product{resultCount === 1 ? "" : "s"}
      </p>
      {hasActiveFilters(value) && (
        <button
          type="button"
          onClick={() => onChange({ sort: value.sort })}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary self-start lg:self-end lg:py-2.5"
        >
          <X className="w-3 h-3" aria-hidden="true" /> Clear filters
        </button>
      )}
    </form>
  );
}
