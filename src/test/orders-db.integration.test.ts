// Real-database test for orders. Runs only with DB_TEST=1 against an EMPTY throwaway
// database (it creates and deletes data). Razorpay is not called.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env["DB_TEST"] === "1";

describe.skipIf(!enabled)("orders against a real database", async () => {
  const catalogue = await import("@/server/catalogue");
  const files = await import("@/server/files");
  const orders = await import("@/server/orders");
  const { getDb } = await import("@/server/db");

  let whey = 0;
  let guide = 0;
  let rx = 0;
  const settings = { shippingFeePaise: 5000, freeShippingFromPaise: 300000 };

  const customer = {
    name: "Asha Rao",
    email: "asha@example.com",
    phone: "9876543210",
    notes: "",
    acceptTerms: true as const,
  };
  const address = {
    line1: "12 MG Road",
    line2: "",
    city: "Bengaluru",
    state: "Karnataka" as const,
    pincode: "560001",
  };

  beforeAll(async () => {
    const db = await getDb();
    for (const t of ["order_items", "orders", "product_images", "products", "shop_settings"])
      await db.query(`DELETE FROM ${t}`);
    const cats = await catalogue.listCategories();
    const cat = (slug: string) => cats.find((c) => c.slug === slug)!.id;
    const base = {
      shortDescription: "",
      description: "",
      details: "",
      compareAtRupees: null,
      isOtc: false,
      requiresPrescription: false,
      imageIds: [] as number[],
      digitalFileId: null as number | null,
      status: "active" as const,
    };
    const pdf = Buffer.from("%PDF-1.7 test");
    const fileId = await files.saveFile("guide.pdf", "application/pdf", pdf, false);
    const r1 = await catalogue.saveProduct({
      ...base,
      name: "Whey",
      categoryId: cat("protein"),
      priceRupees: 1000,
      stock: 3,
    });
    const r2 = await catalogue.saveProduct({
      ...base,
      name: "Meal Guide",
      categoryId: cat("nutrition-guides"),
      priceRupees: 499,
      stock: null,
      digitalFileId: fileId,
    });
    const r3 = await catalogue.saveProduct({
      ...base,
      name: "Rx Item",
      categoryId: cat("prescription-products"),
      priceRupees: 100,
      stock: 10,
      requiresPrescription: true,
    });
    if (!r1.ok || !r2.ok || !r3.ok) throw new Error("product setup failed");
    whey = r1.id;
    guide = r2.id;
    rx = r3.id;
  });

  afterAll(async () => {
    await (await getDb()).end();
  });

  it("saves and reads shop settings", async () => {
    expect(await orders.getShopSettings()).toEqual({
      shippingFeePaise: 0,
      freeShippingFromPaise: null,
    });
    await orders.saveShopSettings(settings);
    expect(await orders.getShopSettings()).toEqual(settings);
  });

  it("returns fresh cart products and hides prescription items from purchase", async () => {
    const list = await orders.getCartProducts([whey, guide, rx, 999999]);
    expect(list.map((p) => p.id).sort()).toEqual([whey, guide, rx].sort());
    expect(list.find((p) => p.id === rx)!.purchasable).toBe(false);
    expect(list.find((p) => p.id === guide)!.stock).toBeNull();
  });

  it("rejects prescription items, too much stock and a missing address", async () => {
    const rxRes = await orders.createPendingOrder(
      { ...customer, address, items: [{ productId: rx, qty: 1 }] },
      settings,
    );
    expect(rxRes.ok).toBe(false);
    const stockRes = await orders.createPendingOrder(
      { ...customer, address, items: [{ productId: whey, qty: 4 }] },
      settings,
    );
    expect(stockRes).toMatchObject({ ok: false, error: expect.stringContaining("Only 3") });
    const noAddr = await orders.createPendingOrder(
      { ...customer, address: null, items: [{ productId: whey, qty: 1 }] },
      settings,
    );
    expect(noAddr.ok).toBe(false);
  });

  it("creates a pending order with server-side totals, then marks it paid exactly once", async () => {
    const res = await orders.createPendingOrder(
      {
        ...customer,
        address,
        items: [
          { productId: whey, qty: 2 },
          { productId: guide, qty: 1 },
        ],
      },
      settings,
    );
    if (!res.ok) throw new Error(res.error);
    const o = res.order;
    expect(o.orderNumber).toMatch(/^WP-[A-Z0-9]{6}$/);
    expect(o.subtotalPaise).toBe(249900);
    expect(o.shippingPaise).toBe(5000);
    expect(o.totalPaise).toBe(254900);
    expect(o.paymentStatus).toBe("pending");
    expect(o.address).toEqual(address);

    await orders.setRazorpayOrderId(o.id, "order_TEST123456");

    // download not available before payment
    const guideItem = o.items.find((i) => i.productId === guide)!;
    expect(guideItem.hasDownload).toBe(true);
    expect(await orders.getDownloadFileId(o.orderNumber, res.accessToken, guideItem.id)).toBeNull();

    // wrong amount is refused
    expect(await orders.markOrderPaid("order_TEST123456", "pay_TEST1", 100)).toHaveProperty(
      "error",
    );

    const first = await orders.markOrderPaid("order_TEST123456", "pay_TEST1", 254900);
    const second = await orders.markOrderPaid("order_TEST123456", "pay_TEST1", 254900);
    expect(first).toMatchObject({ justPaid: true });
    expect(second).toMatchObject({ justPaid: false });

    // stock reduced once (3 - 2)
    const [p] = await orders.getCartProducts([whey]);
    expect(p!.stock).toBe(1);

    // customer access needs the right token
    expect(await orders.getOrderForCustomer(o.orderNumber, "0".repeat(48))).toBeNull();
    const viewed = await orders.getOrderForCustomer(o.orderNumber, res.accessToken);
    expect(viewed?.paymentStatus).toBe("paid");
    expect(viewed?.razorpayPaymentId).toBe("pay_TEST1");

    // download released after payment, never with a wrong token
    expect(
      await orders.getDownloadFileId(o.orderNumber, res.accessToken, guideItem.id),
    ).toBeGreaterThan(0);
    expect(await orders.getDownloadFileId(o.orderNumber, "1".repeat(48), guideItem.id)).toBeNull();

    // admin update + CSV
    const upd = await orders.updateOrderAdmin(o.id, {
      fulfilmentStatus: "shipped",
      trackingInfo: "DTDC 42",
      adminNotes: "packed",
    });
    expect(upd?.after).toMatchObject({ fulfilmentStatus: "shipped", trackingInfo: "DTDC 42" });
    const csv = orders.ordersToCsv(await orders.listOrders());
    expect(csv).toContain(o.orderNumber);
    expect(csv).toContain("2 x Whey");
  });

  it("gives free shipping above the threshold and none for digital-only orders", async () => {
    const digital = await orders.createPendingOrder(
      { ...customer, address: null, items: [{ productId: guide, qty: 1 }] },
      settings,
    );
    if (!digital.ok) throw new Error(digital.error);
    expect(digital.order).toMatchObject({ shippingPaise: 0, totalPaise: 49900, address: null });
  });
});
