// Shared order / checkout definitions (browser + server). All money is in paise.
import { z } from "zod";

import type { CategoryKind } from "./shop-types";

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

// What the browser keeps in localStorage.
export interface CartLine {
  productId: number;
  qty: number;
}

// Fresh product data for the cart page (prices always come from the server).
export interface CartProduct {
  id: number;
  slug: string;
  name: string;
  pricePaise: number;
  imageId: number | null;
  kind: CategoryKind;
  purchasable: boolean;
  stock: number | null; // null = not tracked
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

export function computeTotals(
  lines: { unitPaise: number; qty: number; kind: CategoryKind }[],
  settings: ShopSettings,
): { subtotalPaise: number; shippingPaise: number; totalPaise: number; shipping: boolean } {
  const subtotalPaise = lines.reduce((n, l) => n + l.unitPaise * l.qty, 0);
  const shipping = needsShipping(lines.map((l) => l.kind));
  let shippingPaise = 0;
  if (shipping) {
    const free =
      settings.freeShippingFromPaise !== null && subtotalPaise >= settings.freeShippingFromPaise;
    shippingPaise = free ? 0 : settings.shippingFeePaise;
  }
  return { subtotalPaise, shippingPaise, totalPaise: subtotalPaise + shippingPaise, shipping };
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
  shippingPaise: number;
  totalPaise: number;
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
