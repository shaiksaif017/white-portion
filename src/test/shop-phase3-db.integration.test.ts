// Real-database test for variants, search/filters, coupons, GST and sample data.
// Runs only with DB_TEST=1 against an EMPTY throwaway database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env["DB_TEST"] === "1";

describe.skipIf(!enabled)("shop upgrades against a real database", async () => {
  const catalogue = await import("@/server/catalogue");
  const orders = await import("@/server/orders");
  const coupons = await import("@/server/coupons");
  const sample = await import("@/server/sample-data");
  const files = await import("@/server/files");
  const { getDb } = await import("@/server/db");

  let protein = 0;
  let vitamins = 0;
  let productId = 0;
  const settings = { shippingFeePaise: 5000, freeShippingFromPaise: null };
  const customer = {
    name: "Asha Rao",
    email: "asha@example.com",
    phone: "9876543210",
    notes: "",
    acceptTerms: true as const,
    address: {
      line1: "12 MG Road",
      line2: "",
      city: "Bengaluru",
      state: "Karnataka" as const,
      pincode: "560001",
    },
  };
  const base = {
    shortDescription: "",
    description: "",
    details: "",
    compareAtRupees: null,
    isOtc: false,
    requiresPrescription: false,
    imageIds: [] as number[],
    digitalFileId: null,
    status: "active" as const,
  };

  beforeAll(async () => {
    const db = await getDb();
    for (const t of [
      "order_items",
      "orders",
      "product_variants",
      "product_images",
      "products",
      "coupons",
      "shop_settings",
    ])
      await db.query(`DELETE FROM ${t}`);
    const cats = await catalogue.listCategories();
    const id = (slug: string) => cats.find((c) => c.slug === slug)!.id;
    protein = id("protein");
    vitamins = id("vitamins");
  });

  afterAll(async () => {
    await (await getDb()).end();
  });

  it("adds the new subcategories and columns", async () => {
    const cats = await catalogue.listCategories();
    for (const slug of [
      "post-workout",
      "sports-nutrition",
      "general-wellness",
      "weight-management-guides",
      "muscle-building-guides",
      "beginner-fitness-guides",
    ])
      expect(cats.some((c) => c.slug === slug)).toBe(true);
    const db = await getDb();
    const [cols] = await db.query<import("mysql2").RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'",
    );
    const names = cols.map((c) => String(c["COLUMN_NAME"]));
    expect(names).toEqual(
      expect.arrayContaining([
        "sku",
        "is_featured",
        "gst_rate_bps",
        "preview_file_id",
        "is_sample",
      ]),
    );
  });

  it("saves variants with SKUs, keeps their ids on edit, and rejects duplicate SKUs", async () => {
    const res = await catalogue.saveProduct({
      ...base,
      name: "Whey",
      categoryId: protein,
      priceRupees: 2000,
      stock: null,
      sku: "whey",
      isFeatured: true,
      variants: [
        { name: "1 kg", sku: "whey-1", priceRupees: 2000, compareAtRupees: null, stock: 5 },
        { name: "2 kg", sku: "whey-2", priceRupees: 3500, compareAtRupees: 3900, stock: 0 },
      ],
    });
    if (!res.ok) throw new Error(res.error);
    productId = res.id;
    const [p] = (await catalogue.listAdminProducts()).filter((x) => x.id === productId);
    expect(p!.sku).toBe("WHEY");
    expect(p!.gstRateBps).toBe(1800); // default for shipped products
    expect(p!.variants.map((v) => v.sku)).toEqual(["WHEY-1", "WHEY-2"]);
    const ids = p!.variants.map((v) => v.id);

    // swap SKUs and rename: ids stay stable
    const again = await catalogue.saveProduct({
      ...base,
      id: productId,
      name: "Whey",
      categoryId: protein,
      priceRupees: 2000,
      stock: null,
      sku: "WHEY",
      isFeatured: true,
      variants: [
        {
          id: ids[0],
          name: "1 kg Choc",
          sku: "WHEY-2",
          priceRupees: 2100,
          compareAtRupees: null,
          stock: 5,
        },
        {
          id: ids[1],
          name: "2 kg",
          sku: "WHEY-1",
          priceRupees: 3500,
          compareAtRupees: null,
          stock: 0,
        },
      ],
    });
    expect(again.ok).toBe(true);
    const [p2] = (await catalogue.listAdminProducts()).filter((x) => x.id === productId);
    expect(p2!.variants.map((v) => v.id)).toEqual(ids);

    const dup = await catalogue.saveProduct({
      ...base,
      name: "Other",
      categoryId: vitamins,
      priceRupees: 100,
      stock: 10,
      sku: "WHEY-1",
    });
    expect(dup).toEqual({
      ok: false,
      error: "That SKU is already used by another product or variant.",
    });
  });

  it("shows the lowest variant price and combined stock publicly", async () => {
    const detail = await catalogue.getProductBySlug("whey");
    expect(detail?.hasVariants).toBe(true);
    expect(detail?.pricePaise).toBe(210000);
    expect(detail?.availability).toBe("low_stock"); // 5 + 0
    expect(detail?.variants[1]?.purchasable).toBe(false);
  });

  it("searches, filters and sorts", async () => {
    const r = await catalogue.saveProduct({
      ...base,
      name: "Multivitamin",
      categoryId: vitamins,
      priceRupees: 500,
      stock: 0,
      sku: "MULTI-60",
    });
    expect(r.ok).toBe(true);
    expect((await catalogue.listProducts(null, { q: "multi-60" })).map((p) => p.name)).toEqual([
      "Multivitamin",
    ]);
    expect((await catalogue.listProducts(null, { q: "choc" })).map((p) => p.name)).toEqual([
      "Whey",
    ]);
    expect((await catalogue.listProducts(null, { q: "100%_" })).length).toBe(0); // wildcards escaped
    expect((await catalogue.listProducts(null, { sort: "price_asc" })).map((p) => p.name)).toEqual([
      "Multivitamin",
      "Whey",
    ]);
    expect((await catalogue.listProducts(null, { inStock: true })).map((p) => p.name)).toEqual([
      "Whey",
    ]);
    expect((await catalogue.listProducts(null, { maxRupees: 1000 })).map((p) => p.name)).toEqual([
      "Multivitamin",
    ]);
    expect((await catalogue.listFeaturedProducts()).map((p) => p.name)).toEqual(["Whey"]);
  });

  it("requires a variant choice, prices variants, and reduces variant stock on payment", async () => {
    const [p] = (await catalogue.listAdminProducts()).filter((x) => x.id === productId);
    const v1 = p!.variants[0]!.id!;
    const noChoice = await orders.createPendingOrder(
      { ...customer, couponCode: null, items: [{ productId, variantId: null, qty: 1 }] },
      settings,
    );
    expect(noChoice.ok).toBe(false);

    await coupons.saveCoupon({
      code: "ten",
      description: "",
      type: "percent",
      value: 10,
      minOrderRupees: 1000,
      maxDiscountRupees: null,
      startsAt: null,
      endsAt: null,
      maxUses: 1,
      active: true,
    });
    const res = await orders.createPendingOrder(
      { ...customer, couponCode: "TEN", items: [{ productId, variantId: v1, qty: 2 }] },
      settings,
    );
    if (!res.ok) throw new Error(res.error);
    expect(res.order.subtotalPaise).toBe(420000);
    expect(res.order.discountPaise).toBe(42000);
    expect(res.order.shippingPaise).toBe(5000);
    expect(res.order.totalPaise).toBe(383000);
    expect(res.order.taxPaise).toBe(57661); // GST in 3780 at 18%
    expect(res.order.items[0]).toMatchObject({
      variantName: "1 kg Choc",
      sku: "WHEY-2",
      gstRateBps: 1800,
    });

    await orders.setRazorpayOrderId(res.order.id, "order_PHASE3TEST");
    const paid = await orders.markOrderPaid("order_PHASE3TEST", "pay_PHASE3", 383000);
    expect(paid).toMatchObject({ justPaid: true });
    const [after] = (await catalogue.listAdminProducts()).filter((x) => x.id === productId);
    expect(after!.variants[0]!.stock).toBe(3);

    // coupon used up (max 1 use)
    const again = await orders.priceCart([{ productId, variantId: v1, qty: 1 }], "TEN", settings);
    expect(again).toEqual({ ok: false, error: "This coupon has been fully used." });
    const unknown = await orders.priceCart(
      [{ productId, variantId: v1, qty: 1 }],
      "NOPE",
      settings,
    );
    expect(unknown.ok).toBe(false);
  });

  it("honours coupon dates", async () => {
    await coupons.saveCoupon({
      code: "OLD",
      description: "",
      type: "fixed",
      value: 50,
      minOrderRupees: 0,
      maxDiscountRupees: null,
      startsAt: "2020-01-01",
      endsAt: "2020-12-31",
      maxUses: null,
      active: true,
    });
    const [p] = (await catalogue.listAdminProducts()).filter((x) => x.id === productId);
    const r = await orders.priceCart(
      [{ productId, variantId: p!.variants[0]!.id!, qty: 1 }],
      "OLD",
      settings,
    );
    expect(r).toEqual({ ok: false, error: "This coupon has expired." });
  });

  it("loads and fully removes sample data without touching real data", async () => {
    const realBefore = (await catalogue.listAdminProducts()).filter((p) => !p.isSample).length;
    const loaded = await sample.loadSampleData();
    if (!loaded.ok) throw new Error(loaded.error);
    expect(loaded.products).toBeGreaterThanOrEqual(12);
    expect(loaded.orders).toBe(7);
    expect(await sample.loadSampleData()).toMatchObject({ ok: false });

    const all = await orders.listOrders();
    const sampleOrders = all.filter((o) => o.isSample);
    expect(sampleOrders.length).toBe(7);
    expect(sampleOrders.some((o) => o.discountPaise > 0)).toBe(true);
    expect(sampleOrders.filter((o) => o.paymentStatus === "pending").length).toBe(1);
    const rx = await catalogue.getProductBySlug("sample-prescription-medicine");
    expect(rx?.purchasable).toBe(false);
    const ebook = await catalogue.getProductBySlug("sample-flexible-meal-planning-guide");
    expect(ebook?.previewFileId).not.toBeNull();
    const preview = await files.getFileInfo(ebook!.previewFileId!);
    expect(preview?.isPublic).toBe(true);
    expect(files.sniffMime(await files.readFileData(ebook!.previewFileId!))).toBe(
      "application/pdf",
    );

    const removed = await sample.removeSampleData();
    expect(removed.products).toBe(loaded.products);
    expect(await sample.sampleCounts()).toEqual({ products: 0, orders: 0, coupons: 0 });
    expect((await catalogue.listAdminProducts()).length).toBe(realBefore);
    expect((await orders.listOrders()).filter((o) => o.isSample).length).toBe(0);
  });
});
