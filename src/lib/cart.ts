// Browser cart: product ids, variant ids and quantities in localStorage, shared across
// tabs. Prices are never stored here; the cart page always asks the server.
import { useSyncExternalStore } from "react";

import { type CartLine, lineKey, MAX_CART_LINES, MAX_QTY } from "./order-types";

const KEY = "wpw-cart-v1";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;

const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function read(): CartLine[] {
  if (cache) return cache;
  let lines: CartLine[] = [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) {
      lines = parsed
        .filter(
          (l): l is { productId: number; variantId?: unknown; qty: number } =>
            typeof l === "object" &&
            l !== null &&
            isId((l as CartLine).productId) &&
            Number.isInteger((l as CartLine).qty),
        )
        .map((l) => ({
          productId: l.productId,
          // carts saved before variants existed have no variantId
          variantId: isId(l.variantId) ? l.variantId : null,
          qty: Math.min(Math.max(l.qty, 1), MAX_QTY),
        }))
        .slice(0, MAX_CART_LINES);
    }
  } catch {
    lines = [];
  }
  cache = lines;
  return lines;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode: cart lasts for this page only */
  }
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useCartCount(): number {
  return useCart().reduce((n, l) => n + l.qty, 0);
}

type Ref = { productId: number; variantId: number | null };
const same = (a: Ref, b: Ref) => lineKey(a) === lineKey(b);

export const cart = {
  add(ref: Ref, qty = 1) {
    const lines = [...read()];
    const i = lines.findIndex((l) => same(l, ref));
    if (i >= 0) lines[i] = { ...lines[i]!, qty: Math.min(lines[i]!.qty + qty, MAX_QTY) };
    else if (lines.length < MAX_CART_LINES)
      lines.push({
        productId: ref.productId,
        variantId: ref.variantId,
        qty: Math.min(qty, MAX_QTY),
      });
    write(lines);
  },
  setQty(ref: Ref, qty: number) {
    write(
      read()
        .map((l) => (same(l, ref) ? { ...l, qty: Math.min(qty, MAX_QTY) } : l))
        .filter((l) => l.qty > 0),
    );
  },
  remove(ref: Ref) {
    write(read().filter((l) => !same(l, ref)));
  },
  // Drops lines the server no longer sells.
  keepOnly(keys: Set<string>) {
    const lines = read();
    const kept = lines.filter((l) => keys.has(lineKey(l)));
    if (kept.length !== lines.length) write(kept);
  },
  clear() {
    write([]);
  },
};
