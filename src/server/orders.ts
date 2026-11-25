// Orders data access. Prices, stock and totals are always re-checked here on the
// server; the browser's cart is only a list of product ids and quantities.
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";

import {
  type Address,
  type CartItemInfo,
  type CheckoutSchema,
  type CouponRule,
  type FulfilmentStatus,
  type OrderItem,
  type OrderRecord,
  type PaymentStatus,
  type ShopSettings,
  type Totals,
  computeTotals,
  defaultShopSettings,
  lineKey,
  MAX_QTY,
} from "@/lib/order-types";
import { type CategoryKind, availabilityOf } from "@/lib/shop-types";
import { enrolFromOrder } from "./courses";
import { getDb, isDuplicateKeyError } from "./db";
import { csvCell } from "./csv";

type ParsedCheckout = z.output<typeof CheckoutSchema>;

// ---------- settings ----------

export async function getShopSettings(): Promise<ShopSettings> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT data FROM shop_settings WHERE id = 1");
  const raw = rows[0]?.["data"];
  if (typeof raw !== "string") return defaultShopSettings;
  try {
    return { ...defaultShopSettings, ...(JSON.parse(raw) as Partial<ShopSettings>) };
  } catch {
    return defaultShopSettings;
  }
}

export async function saveShopSettings(s: ShopSettings): Promise<void> {
  const db = await getDb();
  await db.query(
    "INSERT INTO shop_settings (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
    [JSON.stringify(s)],
  );
}

// ---------- cart ----------

interface LineRow extends CartItemInfo {
  digitalFileId: number | null;
}

type Ref = { productId: number; variantId: number | null };

// Fresh price, stock and availability for each cart line, keyed by lineKey().
export async function loadLines(refs: Ref[]): Promise<Map<string, LineRow>> {
  const out = new Map<string, LineRow>();
  const ids = [...new Set(refs.map((r) => r.productId))];
  if (ids.length === 0) return out;
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.id, p.slug, p.name, p.price_paise, p.stock, p.is_otc, p.requires_prescription,
            p.digital_file_id, p.sku, p.gst_rate_bps, c.kind,
            (SELECT file_id FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS image_id
     FROM products p JOIN product_categories c ON c.id = p.category_id
     WHERE p.status = 'active' AND p.id IN (?)`,
    [ids],
  );
  const [vrows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM product_variants WHERE product_id IN (?)",
    [ids],
  );
  const variantsOf = new Map<number, RowDataPacket[]>();
  for (const v of vrows) {
    const list = variantsOf.get(Number(v["product_id"])) ?? [];
    list.push(v);
    variantsOf.set(Number(v["product_id"]), list);
  }
  const byId = new Map(rows.map((r) => [Number(r["id"]), r]));

  for (const ref of refs) {
    const r = byId.get(ref.productId);
    if (!r) continue; // product no longer sold
    const kind = String(r["kind"]) as CategoryKind;
    const digital = kind === "ebook" || kind === "course";
    const variants = variantsOf.get(ref.productId) ?? [];
    const v = ref.variantId ? variants.find((x) => Number(x["id"]) === ref.variantId) : undefined;
    if (ref.variantId && !v) continue; // variant removed
    let problem: string | null = null;
    if (!ref.variantId && variants.length > 0) problem = "Please choose an option for this product";
    const rawStock = v ? v["stock"] : r["stock"];
    const stock = digital || rawStock === null ? null : Number(rawStock);
    const { purchasable } = availabilityOf({
      kind,
      stock,
      requiresPrescription: Boolean(r["requires_prescription"]),
      isOtc: Boolean(r["is_otc"]),
    });
    out.set(lineKey(ref), {
      productId: ref.productId,
      variantId: v ? Number(v["id"]) : null,
      slug: String(r["slug"]),
      name: String(r["name"]),
      variantName: v ? String(v["name"]) : null,
      sku: v?.["sku"] ? String(v["sku"]) : r["sku"] ? String(r["sku"]) : null,
      pricePaise: Number(v ? v["price_paise"] : r["price_paise"]),
      imageId: r["image_id"] === null ? null : Number(r["image_id"]),
      kind,
      purchasable: purchasable && !problem,
      stock,
      gstRateBps: Number(r["gst_rate_bps"]),
      problem,
      digitalFileId: r["digital_file_id"] === null ? null : Number(r["digital_file_id"]),
    });
  }
  return out;
}

export async function getCartItems(refs: Ref[]): Promise<CartItemInfo[]> {
  const map = await loadLines(refs);
  return [...map.values()].map(({ digitalFileId: _d, ...p }) => p);
}

// ---------- coupons ----------

function toRule(r: RowDataPacket): CouponRule {
  return {
    code: String(r["code"]),
    type: String(r["discount_type"]) as CouponRule["type"],
    value: Number(r["discount_value"]),
    minOrderPaise: Number(r["min_order_paise"]),
    maxDiscountPaise: r["max_discount_paise"] === null ? null : Number(r["max_discount_paise"]),
  };
}

// Checks a code is active, in its date window and not used up. Dates are whole days in
// India time (the shop's time zone).
export async function findUsableCoupon(
  code: string,
): Promise<{ ok: true; rule: CouponRule } | { ok: false; error: string }> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT *, DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')) AS today_ist
     FROM coupons WHERE code = ?`,
    [code.trim().toUpperCase()],
  );
  const r = rows[0];
  if (!r || !r["active"]) return { ok: false, error: "This coupon code isn't valid." };
  const today = String(r["today_ist"]).slice(0, 10);
  const day = (v: unknown) => (v ? String(v).slice(0, 10) : null);
  const starts = day(r["starts_at"]);
  const ends = day(r["ends_at"]);
  if (starts && today < starts) return { ok: false, error: "This coupon isn't active yet." };
  if (ends && today > ends) return { ok: false, error: "This coupon has expired." };
  if (r["max_uses"] !== null && Number(r["used_count"]) >= Number(r["max_uses"]))
    return { ok: false, error: "This coupon has been fully used." };
  return { ok: true, rule: toRule(r) };
}

// ---------- creating orders ----------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function newOrderNumber(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `WP-${s}`;
}

export type CreateOrderResult =
  { ok: true; order: OrderRecord; accessToken: string } | { ok: false; error: string };

export type PricedCart =
  | { ok: true; lines: { item: LineRow; qty: number }[]; totals: Totals; coupon: CouponRule | null }
  | { ok: false; error: string };

// Validates the cart and works out the totals exactly as the order will be charged.
export async function priceCart(
  items: { productId: number; variantId: number | null; qty: number }[],
  couponCode: string | null,
  settings: ShopSettings,
): Promise<PricedCart> {
  // merge duplicate lines
  const merged = new Map<string, { ref: Ref; qty: number }>();
  for (const it of items) {
    const key = lineKey(it);
    const prev = merged.get(key);
    merged.set(key, {
      ref: { productId: it.productId, variantId: it.variantId },
      qty: (prev?.qty ?? 0) + it.qty,
    });
  }
  const info = await loadLines([...merged.values()].map((m) => m.ref));
  const lines: { item: LineRow; qty: number }[] = [];
  for (const [key, { qty }] of merged) {
    const p = info.get(key);
    if (!p)
      return {
        ok: false,
        error: "An item in your cart is no longer available. Please review your cart.",
      };
    const label = p.variantName ? `${p.name} (${p.variantName})` : p.name;
    if (p.problem) return { ok: false, error: `${label}: ${p.problem.toLowerCase()}.` };
    if (!p.purchasable)
      return { ok: false, error: `"${label}" can't be ordered online right now.` };
    if (qty > MAX_QTY) return { ok: false, error: `You can order up to ${MAX_QTY} of "${label}".` };
    if (p.stock !== null && qty > p.stock)
      return { ok: false, error: `Only ${p.stock} of "${label}" left in stock.` };
    lines.push({ item: p, qty });
  }

  let coupon: CouponRule | null = null;
  if (couponCode) {
    const found = await findUsableCoupon(couponCode);
    if (!found.ok) return found;
    coupon = found.rule;
  }
  const totals = computeTotals(
    lines.map((l) => ({
      unitPaise: l.item.pricePaise,
      qty: l.qty,
      kind: l.item.kind,
      gstRateBps: l.item.gstRateBps,
    })),
    settings,
    coupon,
  );
  if (coupon && totals.discountPaise === 0) {
    return {
      ok: false,
      error: `Coupon ${coupon.code} applies to orders over ₹${(coupon.minOrderPaise / 100).toLocaleString("en-IN")}.`,
    };
  }
  return { ok: true, lines, totals, coupon };
}

export async function createPendingOrder(
  input: ParsedCheckout,
  settings: ShopSettings,
  opts: { isSample?: boolean } = {},
): Promise<CreateOrderResult> {
  const priced = await priceCart(input.items, input.couponCode, settings);
  if (!priced.ok) return priced;
  const { lines, totals, coupon } = priced;
  if (totals.shipping && !input.address) {
    return { ok: false, error: "Please enter a delivery address." };
  }
  if (totals.totalPaise < 100) {
    return { ok: false, error: "The order total must be at least ₹1." };
  }

  const accessToken = randomBytes(24).toString("hex");
  const db = await getDb();

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = newOrderNumber();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.query<ResultSetHeader>(
        `INSERT INTO orders (order_number, access_token, name, email, phone, address, notes,
           subtotal_paise, discount_paise, coupon_code, shipping_paise, tax_paise, total_paise, is_sample)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          accessToken,
          input.name,
          input.email,
          input.phone,
          totals.shipping && input.address ? JSON.stringify(input.address) : null,
          input.notes,
          totals.subtotalPaise,
          totals.discountPaise,
          coupon?.code ?? null,
          totals.shippingPaise,
          totals.taxPaise,
          totals.totalPaise,
          opts.isSample ? 1 : 0,
        ],
      );
      for (const { item: p, qty } of lines) {
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, product_slug, name, kind, unit_paise, qty,
             digital_file_id, variant_id, variant_name, sku, gst_rate_bps)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            res.insertId,
            p.productId,
            p.slug,
            p.name,
            p.kind,
            p.pricePaise,
            qty,
            p.kind === "ebook" ? p.digitalFileId : null,
            p.variantId,
            p.variantName,
            p.sku,
            p.gstRateBps,
          ],
        );
      }
      await conn.commit();
      const order = await getOrderById(res.insertId);
      if (!order) throw new Error("Order vanished after insert");
      return { ok: true, order, accessToken };
    } catch (error) {
      await conn.rollback();
      if (isDuplicateKeyError(error, "uniq_order_number")) continue;
      throw error;
    } finally {
      conn.release();
    }
  }
  throw new Error("Could not allocate an order number");
}

export async function setRazorpayOrderId(orderId: number, razorpayOrderId: string): Promise<void> {
  const db = await getDb();
  await db.query(
    "UPDATE orders SET razorpay_order_id = ? WHERE id = ? AND payment_status = 'pending'",
    [razorpayOrderId, orderId],
  );
}

// Marks the order paid exactly once (safe to call from both the browser callback and
// the webhook). Returns justPaid=true only for the call that made the change, so
// stock, coupon usage and emails happen once.
export async function markOrderPaid(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  amountPaise: number,
): Promise<{ order: OrderRecord; justPaid: boolean } | { error: string }> {
  const db = await getDb();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT id, payment_status, total_paise, coupon_code FROM orders WHERE razorpay_order_id = ? FOR UPDATE",
      [razorpayOrderId],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return { error: "Order not found" };
    }
    const id = Number(row["id"]);
    if (row["payment_status"] === "paid" || row["payment_status"] === "refunded") {
      await conn.rollback();
      const order = await getOrderById(id);
      return order ? { order, justPaid: false } : { error: "Order not found" };
    }
    if (Number(row["total_paise"]) !== amountPaise) {
      await conn.rollback();
      console.error("[orders] amount mismatch", razorpayOrderId, amountPaise, row["total_paise"]);
      return { error: "Paid amount does not match the order total" };
    }
    await markPaidWithin(
      conn,
      id,
      razorpayPaymentId,
      row["coupon_code"] ? String(row["coupon_code"]) : null,
    );
    await conn.commit();
    const order = await getOrderById(id);
    return order ? { order, justPaid: true } : { error: "Order not found" };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Shared by real payments and the sample-data loader.
export async function markPaidWithin(
  conn: PoolConnection,
  orderId: number,
  paymentId: string,
  couponCode: string | null,
) {
  await conn.query(
    "UPDATE orders SET payment_status = 'paid', razorpay_payment_id = ?, paid_at = UTC_TIMESTAMP() WHERE id = ?",
    [paymentId, orderId],
  );
  await reduceStock(conn, orderId);
  await enrolFromOrder(conn, orderId);
  if (couponCode) {
    await conn.query("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?", [couponCode]);
  }
}

async function reduceStock(conn: PoolConnection, orderId: number) {
  const [items] = await conn.query<RowDataPacket[]>(
    "SELECT product_id, variant_id, qty FROM order_items WHERE order_id = ? AND product_id IS NOT NULL",
    [orderId],
  );
  for (const it of items) {
    if (it["variant_id"] !== null) {
      await conn.query(
        "UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ? AND stock IS NOT NULL",
        [Number(it["qty"]), Number(it["variant_id"])],
      );
    } else {
      await conn.query(
        "UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ? AND stock IS NOT NULL",
        [Number(it["qty"]), Number(it["product_id"])],
      );
    }
  }
}

// ---------- reading ----------

function toOrder(r: RowDataPacket, items: OrderItem[]): OrderRecord {
  let address: Address | null = null;
  if (typeof r["address"] === "string" && r["address"]) {
    try {
      address = JSON.parse(r["address"]) as Address;
    } catch {
      address = null;
    }
  }
  const iso = (v: unknown) => (v ? `${String(v).replace(" ", "T")}Z` : null);
  return {
    id: Number(r["id"]),
    orderNumber: String(r["order_number"]),
    paymentStatus: String(r["payment_status"]) as PaymentStatus,
    fulfilmentStatus: String(r["fulfilment_status"]) as FulfilmentStatus,
    name: String(r["name"]),
    email: String(r["email"]),
    phone: String(r["phone"]),
    address,
    notes: String(r["notes"] ?? ""),
    subtotalPaise: Number(r["subtotal_paise"]),
    discountPaise: Number(r["discount_paise"] ?? 0),
    couponCode: r["coupon_code"] ? String(r["coupon_code"]) : null,
    shippingPaise: Number(r["shipping_paise"]),
    taxPaise: Number(r["tax_paise"] ?? 0),
    totalPaise: Number(r["total_paise"]),
    isSample: Boolean(r["is_sample"]),
    razorpayOrderId: r["razorpay_order_id"] ? String(r["razorpay_order_id"]) : null,
    razorpayPaymentId: r["razorpay_payment_id"] ? String(r["razorpay_payment_id"]) : null,
    trackingInfo: String(r["tracking_info"] ?? ""),
    adminNotes: String(r["admin_notes"] ?? ""),
    paidAt: iso(r["paid_at"]),
    createdAt: iso(r["created_at"]) ?? "",
    items,
  };
}

function toItem(r: RowDataPacket): OrderItem {
  return {
    id: Number(r["id"]),
    productId: r["product_id"] === null ? null : Number(r["product_id"]),
    productSlug: r["product_slug"] ? String(r["product_slug"]) : null,
    name: String(r["name"]),
    kind: String(r["kind"]) as CategoryKind,
    unitPaise: Number(r["unit_paise"]),
    qty: Number(r["qty"]),
    hasDownload: r["digital_file_id"] !== null,
    variantName: r["variant_name"] ? String(r["variant_name"]) : null,
    sku: r["sku"] ? String(r["sku"]) : null,
    gstRateBps: Number(r["gst_rate_bps"] ?? 0),
  };
}

async function itemsFor(orderIds: number[]): Promise<Map<number, OrderItem[]>> {
  const map = new Map<number, OrderItem[]>();
  if (orderIds.length === 0) return map;
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id",
    [orderIds],
  );
  for (const r of rows) {
    const list = map.get(Number(r["order_id"])) ?? [];
    list.push(toItem(r));
    map.set(Number(r["order_id"]), list);
  }
  return map;
}

export async function getOrderById(id: number): Promise<OrderRecord | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ?", [id]);
  const r = rows[0];
  if (!r) return null;
  return toOrder(r, (await itemsFor([id])).get(id) ?? []);
}

export async function getOrderByRazorpayId(razorpayOrderId: string): Promise<OrderRecord | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM orders WHERE razorpay_order_id = ?",
    [razorpayOrderId],
  );
  const id = rows[0]?.["id"];
  return id === undefined ? null : getOrderById(Number(id));
}

function tokenMatches(stored: unknown, given: string): boolean {
  if (typeof stored !== "string") return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Customer access: order number + the secret token from their confirmation link.
export async function getOrderForCustomer(
  orderNumber: string,
  token: string,
): Promise<OrderRecord | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM orders WHERE order_number = ?", [
    orderNumber,
  ]);
  const r = rows[0];
  if (!r || !tokenMatches(r["access_token"], token)) return null;
  const id = Number(r["id"]);
  return toOrder(r, (await itemsFor([id])).get(id) ?? []);
}

export async function getAccessToken(orderId: number): Promise<string | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT access_token FROM orders WHERE id = ?", [
    orderId,
  ]);
  const t = rows[0]?.["access_token"];
  return typeof t === "string" ? t : null;
}

// File for an e-book line, only when the order is paid and the token matches.
export async function getDownloadFileId(
  orderNumber: string,
  token: string,
  itemId: number,
): Promise<number | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT o.access_token, o.payment_status, i.digital_file_id
     FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.order_number = ? AND i.id = ?`,
    [orderNumber, itemId],
  );
  const r = rows[0];
  if (!r || !tokenMatches(r["access_token"], token)) return null;
  if (r["payment_status"] !== "paid" || r["digital_file_id"] === null) return null;
  return Number(r["digital_file_id"]);
}

// ---------- admin ----------

export async function listOrders(limit = 500): Promise<OrderRecord[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT ?",
    [limit],
  );
  const items = await itemsFor(rows.map((r) => Number(r["id"])));
  return rows.map((r) => toOrder(r, items.get(Number(r["id"])) ?? []));
}

export async function updateOrderAdmin(
  id: number,
  patch: { fulfilmentStatus: FulfilmentStatus; trackingInfo: string; adminNotes: string },
): Promise<{ before: OrderRecord; after: OrderRecord } | null> {
  const before = await getOrderById(id);
  if (!before) return null;
  const db = await getDb();
  await db.query(
    "UPDATE orders SET fulfilment_status = ?, tracking_info = ?, admin_notes = ? WHERE id = ?",
    [patch.fulfilmentStatus, patch.trackingInfo, patch.adminNotes, id],
  );
  const after = await getOrderById(id);
  return after ? { before, after } : null;
}

export async function setPaymentStatus(id: number, status: PaymentStatus): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE orders SET payment_status = ? WHERE id = ?", [status, id]);
}

export function ordersToCsv(orders: OrderRecord[]): string {
  const esc = csvCell;
  const header = [
    "Order",
    "Date",
    "Payment",
    "Status",
    "Name",
    "Email",
    "Phone",
    "Items",
    "Subtotal (INR)",
    "Coupon",
    "Discount (INR)",
    "Shipping (INR)",
    "GST included (INR)",
    "Total (INR)",
    "Address",
    "Razorpay payment",
    "Tracking",
  ];
  const lines = orders.map((o) =>
    [
      o.orderNumber,
      o.createdAt,
      o.paymentStatus,
      o.fulfilmentStatus,
      o.name,
      o.email,
      o.phone,
      o.items
        .map(
          (i) =>
            `${i.qty} x ${i.name}${i.variantName ? ` (${i.variantName})` : ""}${i.sku ? ` [${i.sku}]` : ""}`,
        )
        .join("; "),
      (o.subtotalPaise / 100).toFixed(2),
      o.couponCode ?? "",
      (o.discountPaise / 100).toFixed(2),
      (o.shippingPaise / 100).toFixed(2),
      (o.taxPaise / 100).toFixed(2),
      (o.totalPaise / 100).toFixed(2),
      o.address
        ? `${o.address.line1}, ${o.address.line2 ? `${o.address.line2}, ` : ""}${o.address.city}, ${o.address.state} ${o.address.pincode}`
        : "",
      o.razorpayPaymentId ?? "",
      o.trackingInfo,
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
