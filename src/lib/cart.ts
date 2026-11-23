// Browser cart: product ids + quantities in localStorage, shared across tabs.
// Prices are never stored here; the cart page always asks the server.
import { useSyncExternalStore } from "react";

import { type CartLine, MAX_CART_LINES, MAX_QTY } from "./order-types";

const KEY = "wpw-cart-v1";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed)
      ? parsed
          .filter(
            (l): l is CartLine =>
              typeof l === "object" &&
              l !== null &&
              Number.isInteger((l as CartLine).productId) &&
              Number.isInteger((l as CartLine).qty),
          )
          .map((l) => ({ productId: l.productId, qty: Math.min(Math.max(l.qty, 1), MAX_QTY) }))
          .slice(0, MAX_CART_LINES)
      : [];
  } catch {
    cache = [];
  }
  return cache;
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

export const cart = {
  add(productId: number, qty = 1) {
    const lines = [...read()];
    const i = lines.findIndex((l) => l.productId === productId);
    if (i >= 0) lines[i] = { productId, qty: Math.min(lines[i]!.qty + qty, MAX_QTY) };
    else if (lines.length < MAX_CART_LINES) lines.push({ productId, qty: Math.min(qty, MAX_QTY) });
    write(lines);
  },
  setQty(productId: number, qty: number) {
    write(
      read()
        .map((l) => (l.productId === productId ? { productId, qty: Math.min(qty, MAX_QTY) } : l))
        .filter((l) => l.qty > 0),
    );
  },
  remove(productId: number) {
    write(read().filter((l) => l.productId !== productId));
  },
  // Drops products the server no longer sells.
  keepOnly(ids: Set<number>) {
    const lines = read();
    const kept = lines.filter((l) => ids.has(l.productId));
    if (kept.length !== lines.length) write(kept);
  },
  clear() {
    write([]);
  },
};
