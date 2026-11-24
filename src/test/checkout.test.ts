import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildOrderConfirmation, buildOrderStatusUpdate, orderUrl } from "@/lib/order-emails";
import {
  type CouponRule,
  type OrderRecord,
  CheckoutSchema,
  computeTotals,
  couponDiscount,
} from "@/lib/order-types";
import { gstIncluded, SkuSchema } from "@/lib/shop-types";
import { verifyPaymentSignature, verifyWebhookSignature } from "@/server/razorpay";

describe("computeTotals", () => {
  const settings = { shippingFeePaise: 9900, freeShippingFromPaise: 99900 };

  it("charges shipping for physical items below the free threshold", () => {
    const t = computeTotals([{ unitPaise: 50000, qty: 1, kind: "physical" }], settings);
    expect(t).toEqual({
      subtotalPaise: 50000,
      discountPaise: 0,
      shippingPaise: 9900,
      totalPaise: 59900,
      taxPaise: 0,
      shipping: true,
    });
  });

  it("makes shipping free at the threshold", () => {
    const t = computeTotals([{ unitPaise: 33300, qty: 3, kind: "pharma" }], settings);
    expect(t.shippingPaise).toBe(0);
    expect(t.totalPaise).toBe(99900);
  });

  it("never charges shipping for digital-only orders", () => {
    const t = computeTotals(
      [
        { unitPaise: 49900, qty: 1, kind: "ebook" },
        { unitPaise: 199900, qty: 1, kind: "course" },
      ],
      settings,
    );
    expect(t.shipping).toBe(false);
    expect(t.totalPaise).toBe(249800);
  });
});

describe("CheckoutSchema", () => {
  const base = {
    items: [{ productId: 1, qty: 2 }],
    name: "Asha Rao",
    email: "asha@example.com",
    phone: "+91 98765 43210",
    address: null,
    notes: "",
    acceptTerms: true,
  };

  it("accepts a valid digital order and normalises the phone", () => {
    const r = CheckoutSchema.parse(base);
    expect(r.phone).toBe("+919876543210");
  });

  it("rejects bad phone numbers, PIN codes and missing consent", () => {
    expect(CheckoutSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
    expect(CheckoutSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(
      CheckoutSchema.safeParse({
        ...base,
        address: {
          line1: "12 MG Road",
          line2: "",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "05600",
        },
      }).success,
    ).toBe(false);
  });

  it("caps quantities", () => {
    expect(CheckoutSchema.safeParse({ ...base, items: [{ productId: 1, qty: 11 }] }).success).toBe(
      false,
    );
  });
});

describe("Razorpay signatures", () => {
  const secret = "test_secret_123";

  it("verifies the checkout signature", () => {
    const sig = createHmac("sha256", secret).update("order_ABC|pay_XYZ").digest("hex");
    expect(verifyPaymentSignature(secret, "order_ABC", "pay_XYZ", sig)).toBe(true);
    expect(verifyPaymentSignature(secret, "order_ABC", "pay_OTHER", sig)).toBe(false);
    expect(verifyPaymentSignature("wrong", "order_ABC", "pay_XYZ", sig)).toBe(false);
  });

  it("verifies webhook bodies", () => {
    const body = '{"event":"payment.captured"}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(secret, body, sig)).toBe(true);
    expect(verifyWebhookSignature(secret, `${body} `, sig)).toBe(false);
    expect(verifyWebhookSignature(secret, body, "short")).toBe(false);
  });
});

describe("order emails", () => {
  const order: OrderRecord = {
    id: 1,
    orderNumber: "WP-ABC234",
    paymentStatus: "paid",
    fulfilmentStatus: "shipped",
    name: "Asha <b>Rao</b>",
    email: "asha@example.com",
    phone: "+919876543210",
    address: {
      line1: "12 MG Road",
      line2: "",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
    },
    notes: "",
    subtotalPaise: 149800,
    discountPaise: 0,
    couponCode: null,
    taxPaise: 22851,
    isSample: false,
    shippingPaise: 0,
    totalPaise: 149800,
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
    trackingInfo: "Delhivery 1234",
    adminNotes: "",
    paidAt: null,
    createdAt: "",
    items: [
      {
        id: 5,
        productId: 2,
        productSlug: "guide",
        name: "Meal Guide",
        kind: "ebook",
        unitPaise: 49900,
        qty: 1,
        hasDownload: true,
        variantName: null,
        sku: null,
        gstRateBps: 1800,
      },
      {
        id: 6,
        productId: 3,
        productSlug: "whey",
        name: "Whey",
        kind: "physical",
        unitPaise: 99900,
        qty: 1,
        hasDownload: false,
        variantName: null,
        sku: null,
        gstRateBps: 1800,
      },
    ],
  };
  const link = orderUrl("https://example.com", order, "a".repeat(48));

  it("includes the order link, items and escapes HTML", () => {
    const m = buildOrderConfirmation(order, link);
    expect(m.to).toBe("asha@example.com");
    expect(m.text).toContain(link);
    expect(m.text).toContain("1 x Meal Guide");
    expect(m.text).toContain("download");
    expect(m.html).not.toContain("<b>Rao</b>");
  });

  it("status update mentions tracking", () => {
    const m = buildOrderStatusUpdate(order, link);
    expect(m.subject).toContain("shipped");
    expect(m.text).toContain("Delhivery 1234");
  });
});

describe("GST and coupons", () => {
  const settings = { shippingFeePaise: 5000, freeShippingFromPaise: 100000 };
  const pct: CouponRule = {
    code: "TEN",
    type: "percent",
    value: 1000,
    minOrderPaise: 50000,
    maxDiscountPaise: 30000,
  };

  it("extracts GST from GST-inclusive prices", () => {
    expect(gstIncluded(11800, 1800)).toBe(1800); // ₹118 incl. 18% -> ₹18 GST
    expect(gstIncluded(11200, 1200)).toBe(1200);
    expect(gstIncluded(10000, 0)).toBe(0);
  });

  it("applies percent coupons with minimum order and cap", () => {
    expect(couponDiscount(pct, 40000)).toBe(0); // below minimum
    expect(couponDiscount(pct, 100000)).toBe(10000); // 10%
    expect(couponDiscount(pct, 500000)).toBe(30000); // capped at ₹300
  });

  it("never discounts more than the order", () => {
    const fixed: CouponRule = {
      code: "BIG",
      type: "fixed",
      value: 99900,
      minOrderPaise: 0,
      maxDiscountPaise: null,
    };
    expect(couponDiscount(fixed, 50000)).toBe(50000);
  });

  it("spreads the discount over lines and reports GST on the discounted amounts", () => {
    const t = computeTotals(
      [
        { unitPaise: 59000, qty: 1, kind: "physical", gstRateBps: 1800 },
        { unitPaise: 56000, qty: 1, kind: "pharma", gstRateBps: 1200 },
      ],
      settings,
      pct,
    );
    expect(t.subtotalPaise).toBe(115000);
    expect(t.discountPaise).toBe(11500);
    expect(t.shippingPaise).toBe(0); // 1035 after discount >= 1000
    expect(t.totalPaise).toBe(103500);
    // 53100 at 18% + 50400 at 12%
    expect(t.taxPaise).toBe(gstIncluded(53100, 1800) + gstIncluded(50400, 1200));
  });

  it("charges shipping when the discount takes the order under the free threshold", () => {
    const t = computeTotals(
      [{ unitPaise: 105000, qty: 1, kind: "physical", gstRateBps: 1800 }],
      settings,
      pct,
    );
    expect(t.discountPaise).toBe(10500);
    expect(t.shippingPaise).toBe(5000);
    expect(t.totalPaise).toBe(99500);
  });

  it("normalises SKUs and rejects unsafe characters", () => {
    expect(SkuSchema.parse(" wp-whey_1kg ")).toBe("WP-WHEY_1KG");
    expect(SkuSchema.parse("")).toBeNull();
    expect(SkuSchema.safeParse("<script>").success).toBe(false);
  });
});
