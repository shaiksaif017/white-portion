// Server functions for the product catalogue (public pages + admin manager).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  type AdminProduct,
  type CategoryInput,
  type ProductCategory,
  type ProductDetail,
  type ProductInput,
  type ProductSummary,
  DEFAULT_CATEGORIES,
} from "@/lib/shop-types";
import { isAdminRequest } from "@/server/admin-session";
import * as catalogue from "@/server/catalogue";
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

export const getCategoryPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: slugParam, sub: slugParam.optional() }).parse(d))
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
          products = await catalogue.listProductsInCategories(ids);
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
    if (!isAdminRequest()) return unauthorized;
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
    if (!isAdminRequest()) return unauthorized;
    try {
      return await catalogue.saveProduct(data as ProductInput);
    } catch (error) {
      console.error("[admin] save product failed", error);
      return { ok: false, error: "Could not save the product." };
    }
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!isAdminRequest()) return unauthorized;
    try {
      return await catalogue.deleteProduct(data.id);
    } catch (error) {
      console.error("[admin] delete product failed", error);
      return { ok: false, error: "Could not delete the product." };
    }
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<{ ok: true; id: number } | Fail> => {
    if (!isAdminRequest()) return unauthorized;
    try {
      return await catalogue.saveCategory(data as CategoryInput);
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
    if (!isAdminRequest()) return unauthorized;
    try {
      return await catalogue.deleteCategory(data.id);
    } catch (error) {
      console.error("[admin] delete category failed", error);
      return { ok: false, error: "Could not delete the category." };
    }
  });
