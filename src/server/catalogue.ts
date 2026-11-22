// Product catalogue data access. Only "active" products are ever shown publicly.
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import {
  type AdminProduct,
  type CategoryInput,
  type CategoryKind,
  type ProductCategory,
  type ProductDetail,
  type ProductInput,
  type ProductSummary,
  availabilityOf,
  CategoryInputSchema,
  parseDetails,
  ProductInputSchema,
  slugify,
} from "@/lib/shop-types";
import { getDb, isDuplicateKeyError } from "./db";
import { deleteFiles } from "./files";

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

const SUMMARY_SQL = `
  SELECT p.id, p.slug, p.name, p.short_description, p.price_paise, p.compare_at_paise, p.stock,
         p.is_otc, p.requires_prescription, p.created_at,
         c.slug AS category_slug, c.name AS category_name, c.kind,
         (SELECT file_id FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS image_id
  FROM products p JOIN product_categories c ON c.id = p.category_id
  WHERE p.status = 'active'`;

function toSummary(r: RowDataPacket): ProductSummary {
  const kind = String(r["kind"]) as CategoryKind;
  const { availability, purchasable } = availabilityOf({
    kind,
    stock: r["stock"] === null ? null : Number(r["stock"]),
    requiresPrescription: Boolean(r["requires_prescription"]),
    isOtc: Boolean(r["is_otc"]),
  });
  return {
    id: Number(r["id"]),
    slug: String(r["slug"]),
    name: String(r["name"]),
    shortDescription: String(r["short_description"] ?? ""),
    pricePaise: Number(r["price_paise"]),
    compareAtPaise: r["compare_at_paise"] === null ? null : Number(r["compare_at_paise"]),
    imageId: r["image_id"] === null ? null : Number(r["image_id"]),
    categorySlug: String(r["category_slug"]),
    categoryName: String(r["category_name"]),
    kind,
    availability,
    purchasable,
  };
}

export async function listProductsInCategories(
  categoryIds: number[],
  limit = 200,
): Promise<ProductSummary[]> {
  if (categoryIds.length === 0) return [];
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `${SUMMARY_SQL} AND p.category_id IN (?) ORDER BY p.created_at DESC LIMIT ?`,
    [categoryIds, limit],
  );
  return rows.map(toSummary);
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.*, c.slug AS category_slug, c.name AS category_name, c.kind, c.parent_id,
            COALESCE(t.slug, c.slug) AS top_slug, COALESCE(t.name, c.name) AS top_name, COALESCE(t.id, c.id) AS top_id
     FROM products p JOIN product_categories c ON c.id = p.category_id
     LEFT JOIN product_categories t ON t.id = c.parent_id
     WHERE p.slug = ? AND p.status = 'active'`,
    [slug],
  );
  const r = rows[0];
  if (!r) return null;
  const [imgs] = await db.query<RowDataPacket[]>(
    "SELECT file_id FROM product_images WHERE product_id = ? ORDER BY sort_order, id",
    [r["id"]],
  );
  const imageIds = imgs.map((i) => Number(i["file_id"]));
  const summary = toSummary({ ...r, image_id: imageIds[0] ?? null } as RowDataPacket);

  // Related: same subcategory first, then the rest of the top-level category.
  const [catRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM product_categories WHERE id = ? OR parent_id = ?",
    [r["top_id"], r["top_id"]],
  );
  const [rel] = await db.query<RowDataPacket[]>(
    `${SUMMARY_SQL} AND p.category_id IN (?) AND p.id <> ?
     ORDER BY (p.category_id = ?) DESC, p.created_at DESC LIMIT 4`,
    [catRows.map((c) => c["id"]), r["id"], r["category_id"]],
  );

  return {
    ...summary,
    description: String(r["description"] ?? ""),
    details: parseDetails(String(r["details"] ?? "")),
    imageIds,
    topCategorySlug: String(r["top_slug"]),
    topCategoryName: String(r["top_name"]),
    requiresPrescription: Boolean(r["requires_prescription"]),
    isOtc: Boolean(r["is_otc"]),
    related: rel.map(toSummary),
  };
}

// ---------- admin products ----------

function toAdmin(r: RowDataPacket, imageIds: number[]): AdminProduct {
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
    updatedAt: `${String(r["updated_at"]).replace(" ", "T")}Z`,
  };
}

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.*, f.name AS file_name FROM products p LEFT JOIN files f ON f.id = p.digital_file_id
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
  return rows.map((r) => toAdmin(r, byProduct.get(Number(r["id"])) ?? []));
}

export async function saveProduct(
  input: ProductInput,
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
  ];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let id = p.id;
    if (id) {
      const [res] = await conn.query<ResultSetHeader>(
        `UPDATE products SET slug = ?, category_id = ?, name = ?, short_description = ?, description = ?, details = ?,
         price_paise = ?, compare_at_paise = ?, stock = ?, status = ?, is_otc = ?, requires_prescription = ?,
         digital_file_id = ? WHERE id = ?`,
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
         compare_at_paise, stock, status, is_otc, requires_prescription, digital_file_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values,
      );
      id = res.insertId;
    }
    for (const [i, fileId] of p.imageIds.entries()) {
      await conn.query(
        "INSERT INTO product_images (product_id, file_id, sort_order) VALUES (?, ?, ?)",
        [id, fileId, i],
      );
    }
    await conn.commit();
    return { ok: true, id };
  } catch (error) {
    await conn.rollback();
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
    "SELECT digital_file_id FROM products WHERE id = ?",
    [id],
  );
  if (!rows[0]) return { ok: false, error: "Product not found." };
  const [imgs] = await db.query<RowDataPacket[]>(
    "SELECT file_id FROM product_images WHERE product_id = ?",
    [id],
  );
  await db.query("DELETE FROM product_images WHERE product_id = ?", [id]);
  await db.query("DELETE FROM products WHERE id = ?", [id]);
  const fileIds = imgs.map((i) => Number(i["file_id"]));
  if (rows[0]["digital_file_id"] !== null) fileIds.push(Number(rows[0]["digital_file_id"]));
  await deleteFiles(fileIds);
  return { ok: true };
}
