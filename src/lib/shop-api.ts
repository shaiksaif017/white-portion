// Server functions for the product catalogue (public pages + admin manager).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  type AdminProduct,
  type CategoryInput,
  type ProductCategory,
  type ProductDetail,
  type ProductInput,
  type ProductQuery,
  type ProductSummary,
  DEFAULT_CATEGORIES,
  PRODUCT_SORTS,
} from "@/lib/shop-types";
import { adminFor } from "@/server/admin-session";
import * as catalogue from "@/server/catalogue";
import * as sampleData from "@/server/sample-data";
import { isDbConfigured } from "@/server/db";

type Fail = { ok: false; error: string };
const unauthorized: Fail = { ok: false, error: "Your session has expired. Please log in again." };

// Used when the database is unreachable, so the pages still render the structure.
function fallbackCategories(): ProductCategory[] {
  const out: ProductCategory[] = [];
  let id = 1;
  for (const [i, top] of DEFAULT_CATEGORIES.entries()) {
    const topId = id++;
    out.push({
      id: topId,
      slug: top.slug,
      name: top.name,
      parentId: null,
      kind: top.kind,
      description: top.description,
      sortOrder: i,
      productCount: 0,
    });
    for (const [j, c] of top.children.entries()) {
      out.push({
        id: id++,
        slug: c.slug,
        name: c.name,
        parentId: topId,
        kind: top.kind,
        description: c.description,
        sortOrder: j,
        productCount: 0,
      });
    }
  }
  return out;
}

async function safeCategories(): Promise<ProductCategory[]> {
  if (!isDbConfigured()) return fallbackCategories();
  try {
    return await catalogue.listCategories();
  } catch (error) {
    console.error("[shop] categories unavailable", error);
    return fallbackCategories();
  }
}

// ---------- public ----------

export const getShopCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ categories: ProductCategory[] }> => ({ categories: await safeCategories() }),
);

const slugParam = z.string().regex(/^[a-z0-9-]{1,120}$/);

// Search / sort / filter options from the page address (?q=&sort=&stock=1&min=&max=).
export const ProductQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  sort: z.enum(PRODUCT_SORTS as [string, ...string[]]).optional(),
  inStock: z.boolean().optional(),
  minRupees: z.number().min(0).max(10_000_000).optional(),
  maxRupees: z.number().min(0).max(10_000_000).optional(),
});

export const searchProducts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ProductQuerySchema.parse(d))
  .handler(async ({ data }): Promise<{ products: ProductSummary[] }> => {
    if (!isDbConfigured()) return { products: [] };
    try {
      return { products: await catalogue.listProducts(null, data as ProductQuery, 60) };
    } catch (error) {
      console.error("[shop] search failed", error);
      return { products: [] };
    }
  });

export const getFeaturedProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: ProductSummary[] }> => {
    if (!isDbConfigured()) return { products: [] };
    try {
      return { products: await catalogue.listFeaturedProducts(8) };
    } catch (error) {
      console.error("[shop] featured failed", error);
      return { products: [] };
    }
  },
);

export const getCategoryPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: slugParam, sub: slugParam.optional() }).merge(ProductQuerySchema).parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<
      | {
          found: true;
          category: ProductCategory;
          subcategories: ProductCategory[];
          activeSub: ProductCategory | null;
          products: ProductSummary[];
          allCategories: ProductCategory[];
        }
      | { found: false }
    > => {
      const all = await safeCategories();
      const category = all.find((c) => c.slug === data.slug && c.parentId === null);
      if (!category) return { found: false };
      const subcategories = all.filter((c) => c.parentId === category.id);
      const activeSub = data.sub ? (subcategories.find((s) => s.slug === data.sub) ?? null) : null;
      if (data.sub && !activeSub) return { found: false };
      let products: ProductSummary[] = [];
      if (isDbConfigured()) {
        try {
          const ids = activeSub ? [activeSub.id] : [category.id, ...subcategories.map((s) => s.id)];
          const { slug: _s, sub: _u, ...query } = data;
          products = await catalogue.listProducts(ids, query as ProductQuery);
        } catch (error) {
          console.error("[shop] products unavailable", error);
        }
      }
      return { found: true, category, subcategories, activeSub, products, allCategories: all };
    },
  );

export const getProductPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: slugParam }).parse(d))
  .handler(async ({ data }): Promise<{ product: ProductDetail | null }> => {
    if (!isDbConfigured()) return { product: null };
    try {
      return { product: await catalogue.getProductBySlug(data.slug) };
    } catch (error) {
      console.error("[shop] product unavailable", error);
      return { product: null };
    }
  });

// ---------- admin ----------

export const adminGetCatalogue = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    { ok: true; categories: ProductCategory[]; products: AdminProduct[] } | Fail
  > => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      const [categories, products] = await Promise.all([
        catalogue.listCategories(),
        catalogue.listAdminProducts(),
      ]);
      return { ok: true, categories, products };
    } catch (error) {
      console.error("[admin] catalogue failed", error);
      return { ok: false, error: "Could not load products from the database." };
    }
  },
);

export const adminSaveProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<{ ok: true; id: number } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      const input = data as ProductInput;
      const before = input.id ? await catalogue.getAdminProduct(input.id) : null;
      const res = await catalogue.saveProduct(input);
      if (res.ok) {
        await admin.log(
          before ? "product.updated" : "product.created",
          `#${res.id} ${String(input.name).slice(0, 120)}`,
          productChanges(before, input),
        );
      }
      return res;
    } catch (error) {
      console.error("[admin] save product failed", error);
      return { ok: false, error: "Could not save the product." };
    }
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      const before = await catalogue.getAdminProduct(data.id);
      const res = await catalogue.deleteProduct(data.id);
      if (res.ok) await admin.log("product.deleted", `#${data.id} ${before?.name ?? ""}`);
      return res;
    } catch (error) {
      console.error("[admin] delete product failed", error);
      return { ok: false, error: "Could not delete the product." };
    }
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<{ ok: true; id: number } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      const input = data as CategoryInput;
      const res = await catalogue.saveCategory(input);
      if (res.ok)
        await admin.log(input.id ? "category.updated" : "category.created", String(input.name));
      return res;
    } catch (error) {
      console.error("[admin] save category failed", error);
      return {
        ok: false,
        error:
          error instanceof z.ZodError
            ? (error.issues[0]?.message ?? "Invalid category.")
            : "Could not save the category.",
      };
    }
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      const res = await catalogue.deleteCategory(data.id);
      if (res.ok) await admin.log("category.deleted", `#${data.id}`);
      return res;
    } catch (error) {
      console.error("[admin] delete category failed", error);
      return { ok: false, error: "Could not delete the category." };
    }
  });

// ---------- admin: sample data ----------

export const adminSampleStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    { ok: true; counts: { products: number; orders: number; coupons: number } } | Fail
  > => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      return { ok: true, counts: await sampleData.sampleCounts() };
    } catch (error) {
      console.error("[admin] sample status failed", error);
      return { ok: false, error: "Could not check sample data." };
    }
  },
);

export const adminLoadSampleData = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; products: number; orders: number; coupons: number } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      const res = await sampleData.loadSampleData();
      if (res.ok)
        await admin.log("sample_data.loaded", undefined, {
          products: res.products,
          orders: res.orders,
        });
      return res;
    } catch (error) {
      console.error("[admin] load sample data failed", error);
      return {
        ok: false,
        error: "Could not load all sample data. Use “Remove sample data” and try again.",
      };
    }
  },
);

export const adminRemoveSampleData = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; products: number; orders: number; coupons: number } | Fail> => {
    const admin = await adminFor("products");
    if (!admin.ok) return admin;
    try {
      const res = await sampleData.removeSampleData();
      await admin.log("sample_data.removed", undefined, res);
      return { ok: true, ...res };
    } catch (error) {
      console.error("[admin] remove sample data failed", error);
      return { ok: false, error: "Could not remove sample data." };
    }
  },
);

// Summary of what changed on a product, for the audit log (prices in rupees).
function productChanges(before: AdminProduct | null, after: ProductInput): Record<string, unknown> {
  const rupees = (p: number | null | undefined) => (p == null ? null : p / 100);
  if (!before) return { price: after.priceRupees, stock: after.stock, status: after.status };
  const out: Record<string, unknown> = {};
  const diff = (k: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = `${String(a)} → ${String(b)}`;
  };
  diff("name", before.name, after.name);
  diff("price", rupees(before.pricePaise), after.priceRupees);
  diff("wasPrice", rupees(before.compareAtPaise), after.compareAtRupees);
  diff("stock", before.stock, after.stock);
  diff("status", before.status, after.status);
  diff("featured", before.isFeatured, after.isFeatured ?? false);
  if (after.gstRateBps !== undefined)
    diff("gstPercent", before.gstRateBps / 100, after.gstRateBps / 100);
  const beforeOpts = before.variants
    .map((x) => `${x.name}:${x.pricePaise / 100}:${x.stock ?? "-"}`)
    .join(", ");
  const afterOpts = (after.variants ?? [])
    .map((x) => `${x.name}:${x.priceRupees}:${x.stock ?? "-"}`)
    .join(", ");
  diff("options", beforeOpts, afterOpts);
  return out;
}
