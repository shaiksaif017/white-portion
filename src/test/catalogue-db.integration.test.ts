// Real-database test for the product catalogue. Runs only with DB_TEST=1 against an
// EMPTY throwaway database (it creates and deletes data).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env["DB_TEST"] === "1";

describe.skipIf(!enabled)("catalogue against a real database", async () => {
  const catalogue = await import("@/server/catalogue");
  const files = await import("@/server/files");
  const { getDb } = await import("@/server/db");

  let protein = 0;
  let vitamins = 0;
  let ebooks = 0;
  let otc = 0;

  beforeAll(async () => {
    const db = await getDb(); // creates tables + seeds categories
    await db.query("DELETE FROM product_images");
    await db.query("DELETE FROM products");
    const cats = await catalogue.listCategories();
    const id = (slug: string) => cats.find((c) => c.slug === slug)!.id;
    protein = id("protein");
    vitamins = id("vitamins");
    ebooks = id("nutrition-guides");
    otc = id("otc-healthcare");
  });

  afterAll(async () => {
    await (await getDb()).end();
  });

  const base = {
    shortDescription: "Short",
    description: "Long description",
    details: "Weight: 1 kg\nFlavour: Chocolate",
    compareAtRupees: null,
    stock: 20,
    isOtc: false,
    requiresPrescription: false,
    imageIds: [] as number[],
    digitalFileId: null,
  };

  it("seeds the four top-level categories with their subcategories, idempotently", async () => {
    const cats = await catalogue.listCategories();
    const tops = cats.filter((c) => c.parentId === null).map((c) => c.slug);
    expect(tops).toEqual([
      "supplements-nutrition",
      "ebooks-guides",
      "online-courses",
      "pharmaceuticals",
    ]);
    expect(cats.filter((c) => c.parentId !== null).length).toBe(19);
  });

  it("stores and returns uploaded files byte-for-byte, across chunks", async () => {
    const big = Buffer.alloc(1_300_000, 7); // > 2 chunks
    big.write("%PDF-1.7", 0);
    expect(files.sniffMime(big)).toBe("application/pdf");
    const id = await files.saveFile("guide.pdf", "application/pdf", big, false);
    const info = await files.getFileInfo(id);
    expect(info).toMatchObject({ name: "guide.pdf", size: big.length, isPublic: false });
    expect((await files.readFileData(id)).equals(big)).toBe(true);
  });

  it("shows only active products publicly, with availability and related items", async () => {
    const img = await files.saveFile(
      "p.png",
      "image/png",
      Buffer.from("89504e470d0a1a0a00", "hex"),
      true,
    );
    const a = await catalogue.saveProduct({
      ...base,
      name: "Whey Protein Isolate",
      categoryId: protein,
      priceRupees: 2499,
      compareAtRupees: 2999,
      status: "active",
      imageIds: [img],
    });
    const b = await catalogue.saveProduct({
      ...base,
      name: "Plant Protein",
      categoryId: protein,
      priceRupees: 1999,
      status: "active",
      stock: 3,
    });
    const c = await catalogue.saveProduct({
      ...base,
      name: "Hidden Draft",
      categoryId: protein,
      priceRupees: 100,
      status: "draft",
    });
    const d = await catalogue.saveProduct({
      ...base,
      name: "Multivitamin",
      categoryId: vitamins,
      priceRupees: 599,
      status: "active",
      stock: 0,
    });
    expect([a.ok, b.ok, c.ok, d.ok]).toEqual([true, true, true, true]);

    const p = await catalogue.getProductBySlug("whey-protein-isolate");
    expect(p).toMatchObject({
      name: "Whey Protein Isolate",
      pricePaise: 249900,
      compareAtPaise: 299900,
      availability: "in_stock",
      purchasable: true,
      topCategorySlug: "supplements-nutrition",
      imageIds: [img],
    });
    expect(p!.details).toEqual([
      { label: "Weight", value: "1 kg" },
      { label: "Flavour", value: "Chocolate" },
    ]);
    // same subcategory comes first in related, drafts never appear
    expect(p!.related.map((r) => r.slug)).toEqual(["plant-protein", "multivitamin"]);

    expect((await catalogue.getProductBySlug("plant-protein"))!.availability).toBe("low_stock");
    expect((await catalogue.getProductBySlug("multivitamin"))!).toMatchObject({
      availability: "out_of_stock",
      purchasable: false,
    });
    expect(await catalogue.getProductBySlug("hidden-draft")).toBeNull();

    const cats = await catalogue.listCategories();
    expect(cats.find((x) => x.slug === "supplements-nutrition")!.productCount).toBe(3);
    expect(cats.find((x) => x.slug === "protein")!.productCount).toBe(2);
  });

  it("rejects duplicate web addresses and enforces e-book and pharma rules", async () => {
    const dup = await catalogue.saveProduct({
      ...base,
      name: "Whey Protein Isolate",
      categoryId: protein,
      priceRupees: 1,
      status: "draft",
    });
    expect(dup).toMatchObject({ ok: false });

    const noFile = await catalogue.saveProduct({
      ...base,
      name: "Meal Prep Guide",
      categoryId: ebooks,
      priceRupees: 499,
      status: "active",
    });
    expect(noFile).toMatchObject({ ok: false });
    const fileId = await files.saveFile(
      "g.pdf",
      "application/pdf",
      Buffer.from("%PDF-1.4 x"),
      false,
    );
    const ok = await catalogue.saveProduct({
      ...base,
      name: "Meal Prep Guide",
      categoryId: ebooks,
      priceRupees: 499,
      status: "active",
      digitalFileId: fileId,
    });
    expect(ok.ok).toBe(true);
    expect((await catalogue.getProductBySlug("meal-prep-guide"))!).toMatchObject({
      availability: "digital",
      purchasable: true,
    });

    const rx = await catalogue.saveProduct({
      ...base,
      name: "Rx Item",
      categoryId: otc,
      priceRupees: 100,
      status: "active",
      requiresPrescription: true,
    });
    const otcItem = await catalogue.saveProduct({
      ...base,
      name: "OTC Item",
      categoryId: otc,
      priceRupees: 100,
      status: "active",
      isOtc: true,
    });
    expect([rx.ok, otcItem.ok]).toEqual([true, true]);
    expect((await catalogue.getProductBySlug("rx-item"))!).toMatchObject({
      availability: "enquiry_only",
      purchasable: false,
    });
    expect((await catalogue.getProductBySlug("otc-item"))!).toMatchObject({ purchasable: true });
  });

  it("deletes products together with their images, and protects non-empty categories", async () => {
    const list = await catalogue.listAdminProducts();
    const whey = list.find((p) => p.slug === "whey-protein-isolate")!;
    expect(await catalogue.deleteCategory(protein)).toMatchObject({ ok: false });
    expect(await catalogue.deleteProduct(whey.id)).toEqual({ ok: true });
    expect(await files.getFileInfo(whey.imageIds[0]!)).toBeNull();

    const sub = await catalogue.saveCategory({
      name: "Creatine",
      parentId:
        protein === 0
          ? null
          : (await catalogue.listCategories()).find((c) => c.slug === "supplements-nutrition")!.id,
      kind: "ebook",
      description: "",
      sortOrder: 9,
    });
    expect(sub.ok).toBe(true);
    const created = (await catalogue.listCategories()).find((c) => c.slug === "creatine")!;
    expect(created.kind).toBe("physical"); // inherits parent's kind, ignores the requested one
    expect(await catalogue.deleteCategory(created.id)).toEqual({ ok: true });
  });
});
