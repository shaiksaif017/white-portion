import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildOrderConfirmation, buildOrderStatusUpdate, orderUrl } from "@/lib/order-emails";
import { type OrderRecord, CheckoutSchema, computeTotals } from "@/lib/order-types";
import { verifyPaymentSignature, verifyWebhookSignature } from "@/server/razorpay";

describe("computeTotals", () => {
  const settings = { shippingFeePaise: 9900, freeShippingFromPaise: 99900 };

  it("charges shipping for physical items below the free threshold", () => {
    const t = computeTotals([{ unitPaise: 50000, qty: 1, kind: "physical" }], settings);
    expect(t).toEqual({
      subtotalPaise: 50000,
      shippingPaise: 9900,
      totalPaise: 59900,
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
