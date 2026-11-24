// Coupon codes managed from Admin > Products > Coupons. Usage is counted when an
// order using the code is paid (see orders.markPaidWithin).
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { type AdminCoupon, type CouponInput, CouponInputSchema } from "@/lib/order-types";
import { getDb, isDuplicateKeyError } from "./db";

const day = (v: unknown) => (v ? String(v).slice(0, 10) : null);

function toAdmin(r: RowDataPacket): AdminCoupon {
  return {
    id: Number(r["id"]),
    code: String(r["code"]),
    description: String(r["description"] ?? ""),
    type: String(r["discount_type"]) as AdminCoupon["type"],
    value: Number(r["discount_value"]),
    minOrderPaise: Number(r["min_order_paise"]),
    maxDiscountPaise: r["max_discount_paise"] === null ? null : Number(r["max_discount_paise"]),
    startsAt: day(r["starts_at"]),
    endsAt: day(r["ends_at"]),
    maxUses: r["max_uses"] === null ? null : Number(r["max_uses"]),
    usedCount: Number(r["used_count"]),
    active: Boolean(r["active"]),
    isSample: Boolean(r["is_sample"]),
  };
}

export async function listCoupons(): Promise<AdminCoupon[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM coupons ORDER BY created_at DESC");
  return rows.map(toAdmin);
}

export async function saveCoupon(
  input: CouponInput,
  opts: { isSample?: boolean } = {},
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const parsed = CouponInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the coupon." };
  const c = parsed.data;
  // percent is stored in basis points (10% -> 1000), fixed amounts in paise
  const value = Math.round(c.value * 100);
  const values = [
    c.code,
    c.description,
    c.type,
    value,
    Math.round(c.minOrderRupees * 100),
    c.type === "percent" && c.maxDiscountRupees !== null
      ? Math.round(c.maxDiscountRupees * 100)
      : null,
    c.startsAt,
    c.endsAt,
    c.maxUses,
    c.active ? 1 : 0,
  ];
  const db = await getDb();
  try {
    if (c.id) {
      const [res] = await db.query<ResultSetHeader>(
        `UPDATE coupons SET code = ?, description = ?, discount_type = ?, discount_value = ?, min_order_paise = ?,
         max_discount_paise = ?, starts_at = ?, ends_at = ?, max_uses = ?, active = ? WHERE id = ?`,
        [...values, c.id],
      );
      if (res.affectedRows === 0) return { ok: false, error: "Coupon not found." };
      return { ok: true, id: c.id };
    }
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_paise, max_discount_paise,
       starts_at, ends_at, max_uses, active, is_sample) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...values, opts.isSample ? 1 : 0],
    );
    return { ok: true, id: res.insertId };
  } catch (error) {
    if (isDuplicateKeyError(error))
      return { ok: false, error: `The code ${c.code} already exists.` };
    throw error;
  }
}

export async function deleteCoupon(id: number): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM coupons WHERE id = ?", [id]);
}
