// Server functions for cart, checkout, customer order page and admin Orders.
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import { buildOrderStatusUpdate, orderUrl } from "@/lib/order-emails";
import {
  type AdminCoupon,
  type CartItemInfo,
  type Totals,
  type OrderRecord,
  type PublicOrder,
  type ShopSettings,
  type CouponInput,
  CheckoutSchema,
  FULFILMENT_STATUSES,
  MAX_CART_LINES,
  ShopSettingsSchema,
  toPublicOrder,
} from "@/lib/order-types";
import { adminFor } from "@/server/admin-session";
import { securityAlert } from "@/server/audit";
import { rateLimit } from "@/server/auth";
import * as checkout from "@/server/checkout";
import * as coupons from "@/server/coupons";
import { revokeForOrder } from "@/server/courses";
import { isDbConfigured } from "@/server/db";
import { siteUrl } from "@/server/env";
import { sendEmail } from "@/server/mailer";
import * as orders from "@/server/orders";
import {
  getRazorpayKeys,
  getWebhookSecret,
  KEY_ID_PATTERN,
  keyMode,
  RazorpayError,
  saveRazorpayKeys,
  saveWebhookSecret,
  testKeys,
} from "@/server/razorpay";

type Fail = { ok: false; error: string };
const unauthorized: Fail = { ok: false, error: "Your session has expired. Please log in again." };
const UNAVAILABLE: Fail = {
  ok: false,
  error: "Checkout is temporarily unavailable. Please try again shortly or message us on WhatsApp.",
};

function clientIp(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

// ---------- public ----------

export interface ShopStatus {
  paymentsEnabled: boolean;
  settings: ShopSettings;
}

export const getShopStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShopStatus> => {
    if (!isDbConfigured())
      return {
        paymentsEnabled: false,
        settings: { shippingFeePaise: 0, freeShippingFromPaise: null },
      };
    try {
      const [keys, settings] = await Promise.all([getRazorpayKeys(), orders.getShopSettings()]);
      return { paymentsEnabled: keys !== null, settings };
    } catch (error) {
      console.error("[shop] status failed", error);
      return {
        paymentsEnabled: false,
        settings: { shippingFeePaise: 0, freeShippingFromPaise: null },
      };
    }
  },
);

const cartLines = z
  .array(
    z.object({
      productId: z.number().int().positive(),
      variantId: z.number().int().positive().nullable(),
      qty: z.number().int().min(1).max(10).default(1),
    }),
  )
  .max(MAX_CART_LINES);

export const getCartItems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ lines: cartLines }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; items: CartItemInfo[] } | Fail> => {
    if (!isDbConfigured()) return UNAVAILABLE;
    try {
      return { ok: true, items: await orders.getCartItems(data.lines) };
    } catch (error) {
      console.error("[shop] cart items failed", error);
      return UNAVAILABLE;
    }
  });

// Checks a coupon against the current cart and returns the totals it would give.
export const applyCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(1).max(40),
        lines: cartLines.min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; code: string; totals: Totals } | Fail> => {
    if (!isDbConfigured()) return UNAVAILABLE;
    if (!rateLimit(`coupon:${clientIp()}`, 30, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait a few minutes." };
    }
    try {
      const priced = await orders.priceCart(
        data.lines,
        data.code.toUpperCase(),
        await orders.getShopSettings(),
      );
      if (!priced.ok) return priced;
      return {
        ok: true,
        code: priced.coupon?.code ?? data.code.toUpperCase(),
        totals: priced.totals,
      };
    } catch (error) {
      console.error("[shop] coupon failed", error);
      return UNAVAILABLE;
    }
  });

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<checkout.StartCheckoutResult> => {
    const parsed = CheckoutSchema.safeParse(data);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
    if (!isDbConfigured()) return UNAVAILABLE;
    if (!rateLimit(`checkout:${clientIp()}`, 15, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
    }
    try {
      return await checkout.startCheckout(parsed.data);
    } catch (error) {
      console.error("[checkout] start failed", error);
      if (error instanceof RazorpayError && error.status === 401)
        return { ok: false, error: checkout.PAYMENTS_OFF };
      return UNAVAILABLE;
    }
  });

const rzpId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{6,40}$`));

export const confirmPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        razorpayOrderId: rzpId("order"),
        razorpayPaymentId: rzpId("pay"),
        signature: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!rateLimit(`confirm:${clientIp()}`, 30, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait a few minutes." };
    }
    try {
      const res = await checkout.confirmFromCheckout(data);
      return res.ok ? { ok: true } : res;
    } catch (error) {
      console.error("[checkout] confirm failed", error);
      return {
        ok: false,
        error: "We couldn't confirm your payment yet. Your order page will update shortly.",
      };
    }
  });

const orderNumber = z.string().regex(/^WP-[A-Z0-9]{6}$/);
const accessToken = z.string().regex(/^[a-f0-9]{48}$/);

export const getCustomerOrder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ number: orderNumber, token: accessToken }).parse(d))
  .handler(async ({ data }): Promise<{ order: PublicOrder | null }> => {
    if (!isDbConfigured()) return { order: null };
    if (!rateLimit(`order-view:${clientIp()}`, 120, 15 * 60_000)) return { order: null };
    try {
      let order = await orders.getOrderForCustomer(data.number, data.token);
      if (!order) return { order: null };
      if (order.paymentStatus === "pending" && order.razorpayOrderId) {
        order = await checkout.reconcile(order).catch(() => order as OrderRecord);
      }
      return { order: toPublicOrder(order) };
    } catch (error) {
      console.error("[order] view failed", error);
      return { order: null };
    }
  });

// ---------- admin ----------

export const adminGetOrders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; orders: OrderRecord[] } | Fail> => {
    const admin = await adminFor("orders");
    if (!admin.ok) return admin;
    try {
      return { ok: true, orders: await orders.listOrders(1000) };
    } catch (error) {
      console.error("[admin] orders failed", error);
      return { ok: false, error: "Could not load orders from the database." };
    }
  },
);

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.number().int().positive(),
        fulfilmentStatus: z.enum(FULFILMENT_STATUSES as [string, ...string[]]),
        trackingInfo: z.string().trim().max(500),
        adminNotes: z.string().trim().max(5000),
        notifyCustomer: z.boolean(),
      })
      .parse(d),
  )
  .handler(
    async ({ data }): Promise<{ ok: true; order: OrderRecord; emailed: string | null } | Fail> => {
      const admin = await adminFor("orders");
      if (!admin.ok) return admin;
      try {
        const res = await orders.updateOrderAdmin(data.id, {
          fulfilmentStatus: data.fulfilmentStatus as OrderRecord["fulfilmentStatus"],
          trackingInfo: data.trackingInfo,
          adminNotes: data.adminNotes,
        });
        if (!res) return { ok: false, error: "Order not found." };
        let emailed: string | null = null;
        if (data.notifyCustomer && res.after.paymentStatus === "paid") {
          const token = await orders.getAccessToken(res.after.id);
          if (token) {
            const r = await sendEmail(
              buildOrderStatusUpdate(res.after, orderUrl(siteUrl(), res.after, token)),
            );
            emailed = r.status;
          }
        }
        await admin.log("order.updated", res.after.orderNumber, {
          status:
            res.before.fulfilmentStatus !== res.after.fulfilmentStatus
              ? `${res.before.fulfilmentStatus} → ${res.after.fulfilmentStatus}`
              : undefined,
          tracking:
            res.before.trackingInfo !== res.after.trackingInfo ? res.after.trackingInfo : undefined,
          notesChanged: res.before.adminNotes !== res.after.adminNotes || undefined,
          customerEmailed: emailed ?? undefined,
        });
        return { ok: true, order: res.after, emailed };
      } catch (error) {
        console.error("[admin] update order failed", error);
        return { ok: false, error: "Could not update the order." };
      }
    },
  );

export const adminCheckPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; order: OrderRecord } | Fail> => {
    const admin = await adminFor("orders");
    if (!admin.ok) return admin;
    try {
      const order = await orders.getOrderById(data.id);
      if (!order) return { ok: false, error: "Order not found." };
      const after = await checkout.reconcile(order);
      await admin.log("order.payment_checked", order.orderNumber, { result: after.paymentStatus });
      return { ok: true, order: after };
    } catch (error) {
      console.error("[admin] check payment failed", error);
      return { ok: false, error: "Could not reach Razorpay. Please try again." };
    }
  });

export const adminMarkRefunded = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const admin = await adminFor("refunds");
    if (!admin.ok) return admin;
    try {
      const order = await orders.getOrderById(data.id);
      if (!order || order.paymentStatus !== "paid")
        return { ok: false, error: "Only paid orders can be marked refunded." };
      await orders.setPaymentStatus(data.id, "refunded");
      await revokeForOrder(data.id); // refunded courses lose access
      await admin.log("order.refunded", order.orderNumber, { totalPaise: order.totalPaise });
      return { ok: true };
    } catch (error) {
      console.error("[admin] mark refunded failed", error);
      return { ok: false, error: "Could not update the order." };
    }
  });

export const adminExportOrdersCsv = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; csv: string } | Fail> => {
    const admin = await adminFor("orders");
    if (!admin.ok) return admin;
    try {
      await admin.log("orders.exported");
      return { ok: true, csv: orders.ordersToCsv(await orders.listOrders(100_000)) };
    } catch (error) {
      console.error("[admin] export orders failed", error);
      return { ok: false, error: "Could not export orders." };
    }
  },
);

// ---------- admin: payment settings ----------

export interface PaymentSettingsView {
  keyIdMasked: string | null;
  mode: "test" | "live" | null;
  hasWebhookSecret: boolean;
  webhookUrl: string;
  shop: ShopSettings;
}

function mask(keyId: string): string {
  return `${keyId.slice(0, 9)}••••${keyId.slice(-4)}`;
}

async function paymentSettingsView(): Promise<PaymentSettingsView> {
  const [keys, webhook, shop] = await Promise.all([
    getRazorpayKeys(),
    getWebhookSecret(),
    orders.getShopSettings(),
  ]);
  return {
    keyIdMasked: keys ? mask(keys.keyId) : null,
    mode: keys ? keyMode(keys.keyId) : null,
    hasWebhookSecret: webhook !== null,
    webhookUrl: `${siteUrl()}/api/razorpay/webhook`,
    shop,
  };
}

export const adminGetPaymentSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; settings: PaymentSettingsView } | Fail> => {
    const admin = await adminFor("settings");
    if (!admin.ok) return admin;
    try {
      return { ok: true, settings: await paymentSettingsView() };
    } catch (error) {
      console.error("[admin] payment settings failed", error);
      return { ok: false, error: "Could not load payment settings." };
    }
  },
);

export const adminSaveRazorpayKeys = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        keyId: z
          .string()
          .trim()
          .regex(KEY_ID_PATTERN, "The Key ID should start with rzp_test_ or rzp_live_"),
        keySecret: z.string().trim().min(10, "The Key Secret looks too short").max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; settings: PaymentSettingsView } | Fail> => {
    const admin = await adminFor("settings");
    if (!admin.ok) return admin;
    if (!rateLimit(`rzp-keys:${clientIp()}`, 10, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait 15 minutes." };
    }
    try {
      await testKeys(data);
    } catch (error) {
      if (error instanceof RazorpayError && error.status === 401)
        return {
          ok: false,
          error: "Razorpay rejected these keys. Check the Key ID and Key Secret.",
        };
      console.error("[admin] razorpay key test failed", error);
      return { ok: false, error: "Could not reach Razorpay to check the keys. Please try again." };
    }
    try {
      await saveRazorpayKeys(data);
      await admin.log("settings.razorpay_keys_changed", undefined, { mode: keyMode(data.keyId) });
      void securityAlert("Payment keys changed", [
        `${admin.user.email} replaced the Razorpay keys (${keyMode(data.keyId)} mode).`,
      ]);
      return { ok: true, settings: await paymentSettingsView() };
    } catch (error) {
      console.error("[admin] save razorpay keys failed", error);
      return { ok: false, error: "Could not save the keys." };
    }
  });

export const adminSaveWebhookSecret = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ secret: z.string().trim().min(6).max(200) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; settings: PaymentSettingsView } | Fail> => {
    const admin = await adminFor("settings");
    if (!admin.ok) return admin;
    try {
      await saveWebhookSecret(data.secret);
      await admin.log("settings.webhook_secret_changed");
      return { ok: true, settings: await paymentSettingsView() };
    } catch (error) {
      console.error("[admin] save webhook secret failed", error);
      return { ok: false, error: "Could not save the webhook secret." };
    }
  });

export const adminSaveShopSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ShopSettingsSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; settings: PaymentSettingsView } | Fail> => {
    const admin = await adminFor("settings");
    if (!admin.ok) return admin;
    try {
      await orders.saveShopSettings({
        shippingFeePaise: Math.round(data.shippingFeeRupees * 100),
        freeShippingFromPaise:
          data.freeShippingFromRupees === null
            ? null
            : Math.round(data.freeShippingFromRupees * 100),
      });
      await admin.log("settings.shipping", undefined, {
        shippingFeeRupees: data.shippingFeeRupees,
        freeShippingFromRupees: data.freeShippingFromRupees,
      });
      return { ok: true, settings: await paymentSettingsView() };
    } catch (error) {
      console.error("[admin] save shop settings failed", error);
      return { ok: false, error: "Could not save shipping settings." };
    }
  });

// ---------- admin: coupons ----------

export const adminListCoupons = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; coupons: AdminCoupon[] } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      return { ok: true, coupons: await coupons.listCoupons() };
    } catch (error) {
      console.error("[admin] coupons failed", error);
      return { ok: false, error: "Could not load coupons." };
    }
  },
);

export const adminSaveCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<{ ok: true; id: number } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      const input = data as CouponInput;
      const res = await coupons.saveCoupon(input);
      if (res.ok)
        await admin.log(
          input.id ? "coupon.updated" : "coupon.created",
          String(input.code).toUpperCase(),
          {
            type: input.type,
            value: input.value,
            active: input.active,
            maxUses: input.maxUses,
          },
        );
      return res;
    } catch (error) {
      console.error("[admin] save coupon failed", error);
      return { ok: false, error: "Could not save the coupon." };
    }
  });

export const adminDeleteCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      await coupons.deleteCoupon(data.id);
      await admin.log("coupon.deleted", `#${data.id}`);
      return { ok: true };
    } catch (error) {
      console.error("[admin] delete coupon failed", error);
      return { ok: false, error: "Could not delete the coupon." };
    }
  });
