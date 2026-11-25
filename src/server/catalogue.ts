// Product catalogue data access. Only "active" products are ever shown publicly.
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import {
  type AdminProduct,
  type AdminVariant,
  type CategoryInput,
  type CategoryKind,
  type ProductCategory,
  type ProductDetail,
  type ProductInput,
  type ProductQuery,
  type ProductSummary,
  type PublicVariant,
  availabilityOf,
  CategoryInputSchema,
  DEFAULT_GST_BPS,
  parseDetails,
  ProductInputSchema,
  slugify,
} from "@/lib/shop-types";
import { deleteCourseContent } from "./courses";
import { getDb, isDuplicateKeyError } from "./db";
import { deleteFiles } from "./files";

const iso = (v: unknown) => `${String(v).replace(" ", "T")}Z`;

// ---------- categories ----------

export async function listCategories(): Promise<ProductCategory[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') AS own_count
     FROM product_categories c ORDER BY c.parent_id IS NOT NULL, c.sort_order, c.name`,
  );
  const cats = rows.map((r) => ({
    id: Number(r["id"]),
    slug: String(r["slug"]),
    name: String(r["name"]),
    parentId: r["parent_id"] === null ? null : Number(r["parent_id"]),
    kind: String(r["kind"]) as CategoryKind,
    description: r["description"] ? String(r["description"]) : "",
    sortOrder: Number(r["sort_order"]),
    productCount: Number(r["own_count"]),
  }));
  // top-level counts include their subcategories
  for (const c of cats) {
    if (c.parentId === null) {
      c.productCount += cats
        .filter((x) => x.parentId === c.id)
        .reduce((n, x) => n + x.productCount, 0);
    }
  }
  return cats;
}

export async function saveCategory(
  input: CategoryInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const c = CategoryInputSchema.parse(input);
  const db = await getDb();
  const slug = slugify(c.slug || c.name);
  if (!slug) return { ok: false, error: "Please enter a name using letters or numbers." };
  // subcategories inherit the parent's kind
  let kind = c.kind;
  if (c.parentId) {
    const [p] = await db.query<RowDataPacket[]>(
      "SELECT kind, parent_id FROM product_categories WHERE id = ?",
      [c.parentId],
    );
    if (!p[0]) return { ok: false, error: "Parent category not found." };
    if (p[0]["parent_id"] !== null)
      return { ok: false, error: "Subcategories can only be one level deep." };
    kind = String(p[0]["kind"]) as CategoryKind;
  }
  try {
    if (c.id) {
      if (c.parentId === c.id) return { ok: false, error: "A category cannot be its own parent." };
      await db.query(
        "UPDATE product_categories SET name = ?, slug = ?, parent_id = ?, kind = ?, description = ?, sort_order = ? WHERE id = ?",
        [c.name, slug, c.parentId, kind, c.description, c.sortOrder, c.id],
      );
      if (!c.parentId)
        await db.query("UPDATE product_categories SET kind = ? WHERE parent_id = ?", [kind, c.id]);
      return { ok: true, id: c.id };
    }
    const [res] = await db.query<ResultSetHeader>(
      "INSERT INTO product_categories (name, slug, parent_id, kind, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
      [c.name, slug, c.parentId, kind, c.description, c.sortOrder],
    );
    return { ok: true, id: res.insertId };
  } catch (error) {
    if (isDuplicateKeyError(error))
      return { ok: false, error: `The web address "${slug}" is already used by another category.` };
    throw error;
  }
}

export async function deleteCategory(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();
  const [kids] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM product_categories WHERE parent_id = ?",
    [id],
  );
  if (Number(kids[0]?.["n"]) > 0)
    return { ok: false, error: "Delete or move its subcategories first." };
  const [prods] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM products WHERE category_id = ?",
    [id],
  );
  if (Number(prods[0]?.["n"]) > 0)
    return { ok: false, error: "Move or delete the products in this category first." };
  await db.query("DELETE FROM product_categories WHERE id = ?", [id]);
  return { ok: true };
}

// ---------- public products ----------

// Products with variants: price = cheapest variant, stock = total of variant stock
// (NULL when any variant doesn't track stock).
const SUMMARY_SQL = `
  SELECT p.id, p.slug, p.name, p.short_description, p.price_paise, p.compare_at_paise, p.stock,
         p.is_otc, p.requires_prescription, p.created_at, p.is_featured, p.is_sample,
         c.slug AS category_slug, c.name AS category_name, c.kind,
         (SELECT file_id FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS image_id,
         v.v_count, v.v_min_price, v.v_stock, v.v_untracked,
         COALESCE(v.v_min_price, p.price_paise) AS eff_price
  FROM products p
  JOIN product_categories c ON c.id = p.category_id
  LEFT JOIN (
    SELECT product_id, COUNT(*) AS v_count, MIN(price_paise) AS v_min_price,
           SUM(stock) AS v_stock, SUM(stock IS NULL) AS v_untracked
    FROM product_variants GROUP BY product_id
  ) v ON v.product_id = p.id
  WHERE p.status = 'active'`;

function effectiveStock(r: RowDataPacket): number | null {
  if (Number(r["v_count"] ?? 0) > 0) {
    return Number(r["v_untracked"]) > 0 ? null : Number(r["v_stock"] ?? 0);
  }
  return r["stock"] === null ? null : Number(r["stock"]);
}

function toSummary(r: RowDataPacket): ProductSummary {
  const kind = String(r["kind"]) as CategoryKind;
  const hasVariants = Number(r["v_count"] ?? 0) > 0;
  const { availability, purchasable } = availabilityOf({
    kind,
    stock: effectiveStock(r),
    requiresPrescription: Boolean(r["requires_prescription"]),
    isOtc: Boolean(r["is_otc"]),
  });
  return {
    id: Number(r["id"]),
    slug: String(r["slug"]),
    name: String(r["name"]),
    shortDescription: String(r["short_description"] ?? ""),
    pricePaise: hasVariants ? Number(r["v_min_price"]) : Number(r["price_paise"]),
    compareAtPaise:
      hasVariants || r["compare_at_paise"] === null ? null : Number(r["compare_at_paise"]),
    imageId: r["image_id"] === null ? null : Number(r["image_id"]),
    categorySlug: String(r["category_slug"]),
    categoryName: String(r["category_name"]),
    kind,
    availability,
    purchasable,
    isFeatured: Boolean(r["is_featured"]),
    hasVariants,
    isSample: Boolean(r["is_sample"]),
    createdAt: iso(r["created_at"]),
  };
}

const ORDER_BY: Record<NonNullable<ProductQuery["sort"]>, string> = {
  featured: "p.is_featured DESC, p.created_at DESC, p.id DESC",
  newest: "p.created_at DESC, p.id DESC",
  price_asc: "eff_price ASC, p.id DESC",
  price_desc: "eff_price DESC, p.id DESC",
  name: "p.name ASC",
};

function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Public listing with search, price range, in-stock filter and sorting.
// categoryIds = null searches every category.
export async function listProducts(
  categoryIds: number[] | null,
  query: ProductQuery = {},
  limit = 200,
): Promise<ProductSummary[]> {
  if (categoryIds && categoryIds.length === 0) return [];
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (categoryIds) {
    where.push("p.category_id IN (?)");
    params.push(categoryIds);
  }
  const q = query.q?.trim().slice(0, 80);
  if (q) {
    const like = `%${likeEscape(q)}%`;
    where.push(
      "(p.name LIKE ? OR p.short_description LIKE ? OR p.sku LIKE ? OR c.name LIKE ? OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND (pv.sku LIKE ? OR pv.name LIKE ?)))",
    );
    params.push(like, like, like, like, like, like);
  }
  if (query.minRupees !== undefined) {
    where.push("COALESCE(v.v_min_price, p.price_paise) >= ?");
    params.push(Math.round(query.minRupees * 100));
  }
  if (query.maxRupees !== undefined) {
    where.push("COALESCE(v.v_min_price, p.price_paise) <= ?");
    params.push(Math.round(query.maxRupees * 100));
  }
  const order = ORDER_BY[query.sort ?? "featured"];
  const [rows] = await db.query<RowDataPacket[]>(
    `${SUMMARY_SQL}${where.length ? ` AND ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT ?`,
    [...params, limit],
  );
  let list = rows.map(toSummary);
  if (query.inStock) list = list.filter((p) => p.purchasable);
  return list;
}

// Kept for existing callers: newest first, no filters.
export async function listProductsInCategories(
  categoryIds: number[],
  limit = 200,
): Promise<ProductSummary[]> {
  return listProducts(categoryIds, { sort: "newest" }, limit);
}

export async function listFeaturedProducts(limit = 8): Promise<ProductSummary[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `${SUMMARY_SQL} AND p.is_featured = 1 ORDER BY p.created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toSummary);
}

async function loadVariants(productIds: number[]): Promise<Map<number, RowDataPacket[]>> {
  const map = new Map<number, RowDataPacket[]>();
  if (productIds.length === 0) return map;
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM product_variants WHERE product_id IN (?) ORDER BY sort_order, id",
    [productIds],
  );
  for (const r of rows) {
    const list = map.get(Number(r["product_id"])) ?? [];
    list.push(r);
    map.set(Number(r["product_id"]), list);
  }
  return map;
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(`${SUMMARY_SQL} AND p.slug = ?`, [slug]);
  const s = rows[0];
  if (!s) return null;
  const id = Number(s["id"]);
  const [full] = await db.query<RowDataPacket[]>(
    `SELECT p.*, c.parent_id,
            COALESCE(t.slug, c.slug) AS top_slug, COALESCE(t.name, c.name) AS top_name, COALESCE(t.id, c.id) AS top_id
     FROM products p JOIN product_categories c ON c.id = p.category_id
     LEFT JOIN product_categories t ON t.id = c.parent_id
     WHERE p.id = ?`,
    [id],
  );
  const r = full[0];
  if (!r) return null;
  const [imgs] = await db.query<RowDataPacket[]>(
    "SELECT file_id FROM product_images WHERE product_id = ? ORDER BY sort_order, id",
    [id],
  );
  const summary = toSummary(s);
  const kind = summary.kind;
  const variants: PublicVariant[] = ((await loadVariants([id])).get(id) ?? []).map((v) => {
    const a = availabilityOf({
      kind,
      stock: v["stock"] === null ? null : Number(v["stock"]),
      requiresPrescription: Boolean(r["requires_prescription"]),
      isOtc: Boolean(r["is_otc"]),
    });
    return {
      id: Number(v["id"]),
      name: String(v["name"]),
      sku: v["sku"] ? String(v["sku"]) : null,
      pricePaise: Number(v["price_paise"]),
      compareAtPaise: v["compare_at_paise"] === null ? null : Number(v["compare_at_paise"]),
      ...a,
    };
  });

  // Related: same subcategory first, then the rest of the top-level category.
  const [catRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM product_categories WHERE id = ? OR parent_id = ?",
    [r["top_id"], r["top_id"]],
  );
  const [rel] = await db.query<RowDataPacket[]>(
    `${SUMMARY_SQL} AND p.category_id IN (?) AND p.id <> ?
     ORDER BY (p.category_id = ?) DESC, p.is_featured DESC, p.created_at DESC LIMIT 4`,
    [catRows.map((c) => c["id"]), id, r["category_id"]],
  );

  return {
    ...summary,
    description: String(r["description"] ?? ""),
    details: parseDetails(String(r["details"] ?? "")),
    imageIds: imgs.map((i) => Number(i["file_id"])),
    topCategorySlug: String(r["top_slug"]),
    topCategoryName: String(r["top_name"]),
    requiresPrescription: Boolean(r["requires_prescription"]),
    isOtc: Boolean(r["is_otc"]),
    sku: r["sku"] ? String(r["sku"]) : null,
    gstRateBps: Number(r["gst_rate_bps"]),
    previewFileId: r["preview_file_id"] === null ? null : Number(r["preview_file_id"]),
    variants,
    related: rel.map(toSummary),
  };
}

// ---------- admin products ----------

function toAdmin(r: RowDataPacket, imageIds: number[], variants: RowDataPacket[]): AdminProduct {
  return {
    id: Number(r["id"]),
    slug: String(r["slug"]),
    categoryId: Number(r["category_id"]),
    name: String(r["name"]),
    shortDescription: String(r["short_description"] ?? ""),
    description: String(r["description"] ?? ""),
    details: String(r["details"] ?? ""),
    pricePaise: Number(r["price_paise"]),
    compareAtPaise: r["compare_at_paise"] === null ? null : Number(r["compare_at_paise"]),
    stock: r["stock"] === null ? null : Number(r["stock"]),
    status: String(r["status"]) as AdminProduct["status"],
    isOtc: Boolean(r["is_otc"]),
    requiresPrescription: Boolean(r["requires_prescription"]),
    imageIds,
    digitalFileId: r["digital_file_id"] === null ? null : Number(r["digital_file_id"]),
    digitalFileName: r["file_name"] ? String(r["file_name"]) : null,
    sku: r["sku"] ? String(r["sku"]) : null,
    isFeatured: Boolean(r["is_featured"]),
    gstRateBps: Number(r["gst_rate_bps"]),
    previewFileId: r["preview_file_id"] === null ? null : Number(r["preview_file_id"]),
    previewFileName: r["preview_name"] ? String(r["preview_name"]) : null,
    variants: variants.map((v): AdminVariant => ({
      id: Number(v["id"]),
      name: String(v["name"]),
      sku: v["sku"] ? String(v["sku"]) : null,
      pricePaise: Number(v["price_paise"]),
      compareAtPaise: v["compare_at_paise"] === null ? null : Number(v["compare_at_paise"]),
      stock: v["stock"] === null ? null : Number(v["stock"]),
    })),
    isSample: Boolean(r["is_sample"]),
    updatedAt: iso(r["updated_at"]),
  };
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.*, f.name AS file_name, pf.name AS preview_name FROM products p
     LEFT JOIN files f ON f.id = p.digital_file_id
     LEFT JOIN files pf ON pf.id = p.preview_file_id
     ORDER BY p.updated_at DESC LIMIT 2000`,
  );
  const [imgs] = await db.query<RowDataPacket[]>(
    "SELECT product_id, file_id FROM product_images ORDER BY sort_order, id",
  );
  const byProduct = new Map<number, number[]>();
  for (const i of imgs) {
    const list = byProduct.get(Number(i["product_id"])) ?? [];
    list.push(Number(i["file_id"]));
    byProduct.set(Number(i["product_id"]), list);
  }
  const variants = await loadVariants(rows.map((r) => Number(r["id"])));
  return rows.map((r) =>
    toAdmin(r, byProduct.get(Number(r["id"])) ?? [], variants.get(Number(r["id"])) ?? []),
  );
}

export async function getAdminProduct(id: number): Promise<AdminProduct | null> {
  const all = await listAdminProducts();
  return all.find((p) => p.id === id) ?? null;
}

async function saveVariants(
  conn: PoolConnection,
  productId: number,
  variants: {
    id?: number | undefined;
    name: string;
    sku: string | null;
    priceRupees: number;
    compareAtRupees: number | null;
    stock: number | null;
  }[],
  tracksStock: boolean,
) {
  const [existing] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM product_variants WHERE product_id = ?",
    [productId],
  );
  const existingIds = new Set(existing.map((r) => Number(r["id"])));
  const keep = new Set<number>();
  // Free up SKUs first so swapping SKUs between variants doesn't hit the unique index.
  await conn.query("UPDATE product_variants SET sku = NULL WHERE product_id = ?", [productId]);
  for (const [i, v] of variants.entries()) {
    const values = [
      v.name,
      v.sku,
      Math.round(v.priceRupees * 100),
      v.compareAtRupees === null ? null : Math.round(v.compareAtRupees * 100),
      tracksStock ? v.stock : null,
      i,
    ];
    // Keep ids stable so carts that point at a variant keep working.
    if (v.id && existingIds.has(v.id)) {
      await conn.query(
        "UPDATE product_variants SET name = ?, sku = ?, price_paise = ?, compare_at_paise = ?, stock = ?, sort_order = ? WHERE id = ?",
        [...values, v.id],
      );
      keep.add(v.id);
    } else {
      await conn.query(
        "INSERT INTO product_variants (name, sku, price_paise, compare_at_paise, stock, sort_order, product_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [...values, productId],
      );
    }
  }
  const remove = [...existingIds].filter((id) => !keep.has(id));
  if (remove.length) await conn.query("DELETE FROM product_variants WHERE id IN (?)", [remove]);
}

export async function saveProduct(
  input: ProductInput,
  opts: { isSample?: boolean } = {},
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const parsed = ProductInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const p = parsed.data;
  const db = await getDb();

  const [cat] = await db.query<RowDataPacket[]>(
    "SELECT kind FROM product_categories WHERE id = ?",
    [p.categoryId],
  );
  if (!cat[0]) return { ok: false, error: "Category not found." };
  const kind = String(cat[0]["kind"]) as CategoryKind;
  const isDigital = kind === "ebook" || kind === "course";

  if (kind === "ebook" && p.status === "active" && !p.digitalFileId) {
    return { ok: false, error: "Upload the e-book file before publishing this product." };
  }
  if (p.requiresPrescription && p.isOtc) {
    return { ok: false, error: "A product cannot be both OTC and prescription-only." };
  }
  if (isDigital && p.variants.length > 0) {
    return { ok: false, error: "Variants are for shipped products (sizes, flavours, pack sizes)." };
  }

  // SKUs must be unique across all products AND all variants (two tables, so the
  // database's own unique indexes can't check this on their own).
  const skus = [p.sku, ...p.variants.map((v) => v.sku)].filter((x): x is string => Boolean(x));
  if (skus.length) {
    const [clash] = await db.query<RowDataPacket[]>(
      `SELECT sku FROM products WHERE sku IN (?) AND id <> ?
       UNION SELECT sku FROM product_variants WHERE sku IN (?) AND product_id <> ? LIMIT 1`,
      [skus, p.id ?? 0, skus, p.id ?? 0],
    );
    if (clash[0])
      return { ok: false, error: "That SKU is already used by another product or variant." };
  }

  const slug = slugify(p.slug || p.name);
  if (!slug) return { ok: false, error: "Please enter a name using letters or numbers." };
  const values = [
    slug,
    p.categoryId,
    p.name,
    p.shortDescription,
    p.description,
    p.details,
    Math.round(p.priceRupees * 100),
    p.compareAtRupees === null ? null : Math.round(p.compareAtRupees * 100),
    isDigital ? null : p.stock,
    p.status,
    kind === "pharma" && p.isOtc ? 1 : 0,
    kind === "pharma" && p.requiresPrescription ? 1 : 0,
    kind === "ebook" ? p.digitalFileId : null,
    p.sku,
    p.isFeatured ? 1 : 0,
    p.gstRateBps ?? DEFAULT_GST_BPS[kind],
    kind === "ebook" ? p.previewFileId : null,
  ];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let id = p.id;
    if (id) {
      const [res] = await conn.query<ResultSetHeader>(
        `UPDATE products SET slug = ?, category_id = ?, name = ?, short_description = ?, description = ?, details = ?,
         price_paise = ?, compare_at_paise = ?, stock = ?, status = ?, is_otc = ?, requires_prescription = ?,
         digital_file_id = ?, sku = ?, is_featured = ?, gst_rate_bps = ?, preview_file_id = ? WHERE id = ?`,
        [...values, id],
      );
      if (res.affectedRows === 0) {
        await conn.rollback();
        return { ok: false, error: "Product not found." };
      }
      await conn.query("DELETE FROM product_images WHERE product_id = ?", [id]);
    } else {
      const [res] = await conn.query<ResultSetHeader>(
        `INSERT INTO products (slug, category_id, name, short_description, description, details, price_paise,
         compare_at_paise, stock, status, is_otc, requires_prescription, digital_file_id, sku, is_featured,
         gst_rate_bps, preview_file_id, is_sample)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...values, opts.isSample ? 1 : 0],
      );
      id = res.insertId;
    }
    for (const [i, fileId] of p.imageIds.entries()) {
      await conn.query(
        "INSERT INTO product_images (product_id, file_id, sort_order) VALUES (?, ?, ?)",
        [id, fileId, i],
      );
    }
    await saveVariants(conn, id, p.variants, !isDigital);
    await conn.commit();
    return { ok: true, id };
  } catch (error) {
    await conn.rollback();
    if (isDuplicateKeyError(error, "sku"))
      return { ok: false, error: "That SKU is already used by another product or variant." };
    if (isDuplicateKeyError(error))
      return { ok: false, error: `The web address "${slug}" is already used by another product.` };
    throw error;
  } finally {
    conn.release();
  }
}

export async function deleteProduct(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT digital_file_id, preview_file_id FROM products WHERE id = ?",
    [id],
  );
  if (!rows[0]) return { ok: false, error: "Product not found." };
  const [imgs] = await db.query<RowDataPacket[]>(
    "SELECT file_id FROM product_images WHERE product_id = ?",
    [id],
  );
  await db.query("DELETE FROM product_images WHERE product_id = ?", [id]);
  await db.query("DELETE FROM product_variants WHERE product_id = ?", [id]);
  const lessonFiles = await deleteCourseContent(id);
  await db.query("DELETE FROM products WHERE id = ?", [id]);
  const fileIds = [...imgs.map((i) => Number(i["file_id"])), ...lessonFiles];
  for (const col of ["digital_file_id", "preview_file_id"]) {
    if (rows[0][col] !== null) fileIds.push(Number(rows[0][col]));
  }
  // Keep e-book files that paid orders still need to download.
  const [used] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT digital_file_id FROM order_items WHERE digital_file_id IN (?)",
    [fileIds.length ? fileIds : [0]],
  );
  const keep = new Set(used.map((u) => Number(u["digital_file_id"])));
  await deleteFiles(fileIds.filter((f) => !keep.has(f)));
  return { ok: true };
}
