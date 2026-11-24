// Shared order / checkout definitions (browser + server). All money is in paise.
import { z } from "zod";

import { type CategoryKind, gstIncluded } from "./shop-types";

// Payment state (driven by Razorpay) and fulfilment state (driven by the owner) are
// kept separate so a paid order can move through processing -> shipped -> delivered.
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type FulfilmentStatus =
  "new" | "processing" | "shipped" | "delivered" | "completed" | "cancelled";

export const FULFILMENT_STATUSES: FulfilmentStatus[] = [
  "new",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
];

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

export const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  new: "New",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const MAX_QTY = 10;
export const MAX_CART_LINES = 30;

// What the browser keeps in localStorage. variantId is set for products sold in
// several sizes / flavours; null for products without variants.
export interface CartLine {
  productId: number;
  variantId: number | null;
  qty: number;
}

export function lineKey(l: { productId: number; variantId: number | null }): string {
  return `${l.productId}:${l.variantId ?? 0}`;
}

// Fresh data for one cart line (prices always come from the server).
export interface CartItemInfo {
  productId: number;
  variantId: number | null;
  slug: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  pricePaise: number;
  imageId: number | null;
  kind: CategoryKind;
  purchasable: boolean;
  stock: number | null; // null = not tracked
  gstRateBps: number;
  problem: string | null; // e.g. "Choose a size" when a variant is required but missing
}

// ---------- coupons ----------

export type DiscountType = "percent" | "fixed";

export interface CouponRule {
  code: string;
  type: DiscountType;
  value: number; // percent: basis points (1000 = 10%); fixed: paise
  minOrderPaise: number;
  maxDiscountPaise: number | null;
}

export function couponDiscount(rule: CouponRule, subtotalPaise: number): number {
  if (subtotalPaise < rule.minOrderPaise) return 0;
  let d = rule.type === "percent" ? Math.floor((subtotalPaise * rule.value) / 10_000) : rule.value;
  if (rule.maxDiscountPaise !== null) d = Math.min(d, rule.maxDiscountPaise);
  return Math.max(0, Math.min(d, subtotalPaise));
}

export function describeCoupon(rule: CouponRule): string {
  const off =
    rule.type === "percent"
      ? `${rule.value / 100}% off`
      : `₹${(rule.value / 100).toLocaleString("en-IN")} off`;
  const min =
    rule.minOrderPaise > 0
      ? ` on orders over ₹${(rule.minOrderPaise / 100).toLocaleString("en-IN")}`
      : "";
  const cap =
    rule.type === "percent" && rule.maxDiscountPaise !== null
      ? ` (up to ₹${(rule.maxDiscountPaise / 100).toLocaleString("en-IN")})`
      : "";
  return `${off}${min}${cap}`;
}

export const CouponInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, "Codes use 3–40 letters, numbers, - or _"),
    description: z.string().trim().max(200),
    type: z.enum(["percent", "fixed"]),
    value: z.number().positive("Enter the discount"),
    minOrderRupees: z.number().min(0).max(10_000_000),
    maxDiscountRupees: z.number().positive().max(10_000_000).nullable(),
    startsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    maxUses: z.number().int().positive().max(1_000_000).nullable(),
    active: z.boolean(),
  })
  .refine((c) => c.type !== "percent" || c.value <= 90, {
    message: "Percentage discounts can be at most 90%",
  })
  .refine((c) => !c.startsAt || !c.endsAt || c.startsAt <= c.endsAt, {
    message: "The end date must be after the start date",
  });
export type CouponInput = z.input<typeof CouponInputSchema>;

export interface AdminCoupon {
  id: number;
  code: string;
  description: string;
  type: DiscountType;
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  isSample: boolean;
}

export interface ShopSettings {
  shippingFeePaise: number;
  freeShippingFromPaise: number | null; // null = never free
}

export const defaultShopSettings: ShopSettings = {
  shippingFeePaise: 0,
  freeShippingFromPaise: null,
};

export const ShopSettingsSchema = z.object({
  shippingFeeRupees: z.number().min(0).max(100_000),
  freeShippingFromRupees: z.number().min(0).max(10_000_000).nullable(),
});

export function needsShipping(kinds: CategoryKind[]): boolean {
  return kinds.some((k) => k === "physical" || k === "pharma");
}

export interface Totals {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  taxPaise: number; // GST already included in the product prices (shown for information)
  shipping: boolean;
}

// Prices include GST. The discount is shared across lines in proportion to their value,
// and the GST contained in each discounted line is added up for the tax breakdown.
// Free shipping is judged on the amount after discount.
export function computeTotals(
  lines: { unitPaise: number; qty: number; kind: CategoryKind; gstRateBps?: number }[],
  settings: ShopSettings,
  coupon: CouponRule | null = null,
): Totals {
  const subtotalPaise = lines.reduce((n, l) => n + l.unitPaise * l.qty, 0);
  const discountPaise = coupon ? couponDiscount(coupon, subtotalPaise) : 0;
  const shipping = needsShipping(lines.map((l) => l.kind));
  const afterDiscount = subtotalPaise - discountPaise;
  let shippingPaise = 0;
  if (shipping) {
    const free =
      settings.freeShippingFromPaise !== null && afterDiscount >= settings.freeShippingFromPaise;
    shippingPaise = free ? 0 : settings.shippingFeePaise;
  }
  let taxPaise = 0;
  let allocated = 0;
  lines.forEach((l, i) => {
    const amount = l.unitPaise * l.qty;
    const share =
      i === lines.length - 1
        ? discountPaise - allocated
        : subtotalPaise > 0
          ? Math.floor((discountPaise * amount) / subtotalPaise)
          : 0;
    allocated += share;
    taxPaise += gstIncluded(amount - share, l.gstRateBps ?? 0);
  });
  return {
    subtotalPaise,
    discountPaise,
    shippingPaise,
    totalPaise: afterDiscount + shippingPaise,
    taxPaise,
    shipping,
  };
}

// ---------- checkout form ----------

const t = (max: number) => z.string().trim().max(max);
const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;
export { INDIAN_STATES };

export const AddressSchema = z.object({
  line1: t(200).pipe(z.string().min(3, "Enter your house / street address")),
  line2: t(200),
  city: t(80).pipe(z.string().min(2, "Enter your city")),
  state: z.enum(INDIAN_STATES, { message: "Choose your state" }),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
});
export type Address = z.infer<typeof AddressSchema>;

export const CheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        variantId: z.number().int().positive().nullable().default(null),
        qty: z.number().int().min(1).max(MAX_QTY),
      }),
    )
    .min(1, "Your cart is empty")
    .max(MAX_CART_LINES),
  name: t(120).pipe(z.string().min(2, "Enter your full name")),
  email: t(254).pipe(z.string().email("Enter a valid email address")),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^(\+?91)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")),
  address: AddressSchema.nullable(),
  notes: t(1000),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(40)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .default(null),
  acceptTerms: z.literal(true, { message: "Please accept the terms to continue" }),
});
export type CheckoutInput = z.input<typeof CheckoutSchema>;

// ---------- records ----------

export interface OrderItem {
  id: number;
  productId: number | null;
  productSlug: string | null;
  name: string;
  kind: CategoryKind;
  unitPaise: number;
  qty: number;
  hasDownload: boolean;
  variantName: string | null;
  sku: string | null;
  gstRateBps: number;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  name: string;
  email: string;
  phone: string;
  address: Address | null;
  notes: string;
  subtotalPaise: number;
  discountPaise: number;
  couponCode: string | null;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  isSample: boolean;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  trackingInfo: string;
  adminNotes: string;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

// What the customer's order page receives (no admin notes, no internal ids).
export type PublicOrder = Omit<OrderRecord, "adminNotes" | "razorpayOrderId" | "id">;

export function toPublicOrder(o: OrderRecord): PublicOrder {
  const { adminNotes: _a, razorpayOrderId: _r, id: _i, ...rest } = o;
  return rest;
}

export function formatAddress(a: Address | null): string {
  if (!a) return "";
  return [a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join("\n");
}
