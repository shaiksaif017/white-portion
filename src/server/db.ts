// MySQL connection pool and schema. Tables are created automatically on first use,
// so a fresh, empty Hostinger database works without running any SQL by hand.
import mysql from "mysql2/promise";

import { defaultBookingSettings } from "@/lib/booking-types";
import { DEFAULT_CATEGORIES } from "@/lib/shop-types";
import { dbConfig } from "./env";

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("Database is not configured (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).");
  }
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS appointments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    booking_reference VARCHAR(20) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    whatsapp_number VARCHAR(30) NULL,
    email VARCHAR(254) NOT NULL,
    age VARCHAR(10) NULL,
    gender VARCHAR(30) NULL,
    service VARCHAR(120) NOT NULL,
    fitness_goal VARCHAR(80) NOT NULL,
    current_weight VARCHAR(30) NULL,
    height VARCHAR(30) NULL,
    training_experience VARCHAR(500) NULL,
    dietary_preferences VARCHAR(500) NULL,
    additional_information TEXT NULL,
    appointment_type VARCHAR(40) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time CHAR(5) NOT NULL,
    timezone VARCHAR(60) NOT NULL,
    booking_status VARCHAR(12) NOT NULL DEFAULT 'Pending',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- One live booking per date+time. is_active is 1 for live bookings and NULL
    -- for cancelled ones; a UNIQUE index ignores rows containing NULL, so a
    -- cancelled slot can be booked again. This is what makes double booking
    -- impossible, even with simultaneous requests. (Works on MySQL and MariaDB.)
    is_active TINYINT GENERATED ALWAYS AS (IF(booking_status = 'Cancelled', NULL, 1)) STORED,
    UNIQUE KEY uniq_booking_reference (booking_reference),
    UNIQUE KEY uniq_active_slot (appointment_date, appointment_time, is_active),
    KEY idx_appointment_date (appointment_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS booking_settings (
    id TINYINT NOT NULL PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS app_secrets (
    name VARCHAR(64) NOT NULL PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS notification_log (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(40) NOT NULL,
    recipient VARCHAR(254) NOT NULL,
    subject VARCHAR(300) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(10) NOT NULL,
    error VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ---------- shop ----------
  // Uploaded files (product images, e-book PDFs) live in the database, split into
  // 512 KB chunks, so they survive redeploys and stay under MySQL packet limits.
  `CREATE TABLE IF NOT EXISTS files (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    size INT NOT NULL,
    is_public TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS file_chunks (
    file_id INT NOT NULL,
    idx INT NOT NULL,
    data MEDIUMBLOB NOT NULL,
    PRIMARY KEY (file_id, idx)
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS product_categories (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    parent_id INT NULL,
    kind VARCHAR(12) NOT NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_category_slug (slug),
    KEY idx_parent (parent_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS products (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(120) NOT NULL,
    category_id INT NOT NULL,
    name VARCHAR(160) NOT NULL,
    short_description VARCHAR(300) NOT NULL DEFAULT '',
    description TEXT NULL,
    details TEXT NULL,
    price_paise INT NOT NULL,
    compare_at_paise INT NULL,
    stock INT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'draft',
    is_otc TINYINT NOT NULL DEFAULT 0,
    requires_prescription TINYINT NOT NULL DEFAULT 0,
    digital_file_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_product_slug (slug),
    KEY idx_category_status (category_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    file_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    KEY idx_product (product_id)
  ) ENGINE=InnoDB`,

  // ---------- orders ----------
  `CREATE TABLE IF NOT EXISTS orders (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL,
    access_token CHAR(48) NOT NULL,
    payment_status VARCHAR(10) NOT NULL DEFAULT 'pending',
    fulfilment_status VARCHAR(12) NOT NULL DEFAULT 'new',
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NULL,
    notes TEXT NULL,
    subtotal_paise INT NOT NULL,
    shipping_paise INT NOT NULL,
    total_paise INT NOT NULL,
    razorpay_order_id VARCHAR(40) NULL,
    razorpay_payment_id VARCHAR(40) NULL,
    tracking_info VARCHAR(500) NOT NULL DEFAULT '',
    admin_notes TEXT NULL,
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_order_number (order_number),
    UNIQUE KEY uniq_rzp_order (razorpay_order_id),
    KEY idx_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NULL,
    product_slug VARCHAR(120) NULL,
    name VARCHAR(160) NOT NULL,
    kind VARCHAR(12) NOT NULL,
    unit_paise INT NOT NULL,
    qty INT NOT NULL,
    digital_file_id INT NULL,
    KEY idx_order (order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS shop_settings (
    id TINYINT NOT NULL PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS product_variants (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,
    sku VARCHAR(64) NULL,
    price_paise INT NOT NULL,
    compare_at_paise INT NULL,
    stock INT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_variant_sku (sku),
    KEY idx_variant_product (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS coupons (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    description VARCHAR(200) NOT NULL DEFAULT '',
    discount_type VARCHAR(8) NOT NULL,
    discount_value INT NOT NULL,
    min_order_paise INT NOT NULL DEFAULT 0,
    max_discount_paise INT NULL,
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    max_uses INT NULL,
    used_count INT NOT NULL DEFAULT 0,
    active TINYINT NOT NULL DEFAULT 1,
    is_sample TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_coupon_code (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ---------- customer accounts (log in with an emailed code, no passwords) ----------
  `CREATE TABLE IF NOT EXISTS customers (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL DEFAULT '',
    session_version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL,
    UNIQUE KEY uniq_customer_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS customer_login_codes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used TINYINT NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_code_email (email, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ---------- courses ----------
  `CREATE TABLE IF NOT EXISTS course_modules (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    KEY idx_module_product (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS course_lessons (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    product_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    video_url VARCHAR(500) NOT NULL DEFAULT '',
    duration_minutes INT NOT NULL DEFAULT 0,
    is_preview TINYINT NOT NULL DEFAULT 0,
    attachment_file_id INT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    KEY idx_lesson_module (module_id),
    KEY idx_lesson_product (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  // Access is keyed by email, so a purchase works even before the buyer makes an account.
  `CREATE TABLE IF NOT EXISTS enrolments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    product_id INT NOT NULL,
    order_id INT NULL,
    source VARCHAR(10) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_enrolment (email, product_id),
    KEY idx_enrolment_product (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS lesson_progress (
    email VARCHAR(254) NOT NULL,
    lesson_id INT NOT NULL,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (email, lesson_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

// Columns added after the first release. Each is added only if it is missing, so
// this upgrades existing live databases (MySQL or MariaDB) and fresh ones alike.
const COLUMNS: [table: string, column: string, definition: string][] = [
  ["products", "sku", "VARCHAR(64) NULL"],
  ["products", "is_featured", "TINYINT NOT NULL DEFAULT 0"],
  ["products", "gst_rate_bps", "INT NOT NULL DEFAULT 1800"], // basis points: 1800 = 18%
  ["products", "preview_file_id", "INT NULL"],
  ["products", "is_sample", "TINYINT NOT NULL DEFAULT 0"],
  ["orders", "discount_paise", "INT NOT NULL DEFAULT 0"],
  ["orders", "coupon_code", "VARCHAR(40) NULL"],
  ["orders", "tax_paise", "INT NOT NULL DEFAULT 0"],
  ["orders", "is_sample", "TINYINT NOT NULL DEFAULT 0"],
  ["order_items", "variant_id", "INT NULL"],
  ["order_items", "variant_name", "VARCHAR(120) NULL"],
  ["order_items", "sku", "VARCHAR(64) NULL"],
  ["order_items", "gst_rate_bps", "INT NOT NULL DEFAULT 0"],
  ["products", "course_instructor", "VARCHAR(120) NOT NULL DEFAULT ''"],
  ["products", "course_instructor_bio", "TEXT NULL"],
  ["products", "course_duration", "VARCHAR(60) NOT NULL DEFAULT ''"],
  ["products", "course_level", "VARCHAR(40) NOT NULL DEFAULT ''"],
];

const INDEXES: [table: string, name: string, definition: string][] = [
  ["products", "uniq_product_sku", "UNIQUE KEY uniq_product_sku (sku)"],
  ["products", "idx_featured", "KEY idx_featured (is_featured, status)"],
];

// A failed upgrade step is logged but never blocks the rest of the site (bookings
// keep working even if, say, the database user lacks ALTER permission).
async function migrate(p: mysql.Pool) {
  for (const [table, column, definition] of COLUMNS) {
    try {
      const [rows] = await p.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [table, column],
      );
      if (Number(rows[0]?.["n"]) === 0) {
        await p.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    } catch (error) {
      console.error(`[db] could not add column ${table}.${column}`, error);
    }
  }
  for (const [table, name, definition] of INDEXES) {
    try {
      const [rows] = await p.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
        [table, name],
      );
      if (Number(rows[0]?.["n"]) === 0) await p.query(`ALTER TABLE ${table} ADD ${definition}`);
    } catch (error) {
      console.error(`[db] could not add index ${table}.${name}`, error);
    }
  }
}

async function seedCategories(p: mysql.Pool) {
  for (const [i, top] of DEFAULT_CATEGORIES.entries()) {
    await p.query(
      "INSERT IGNORE INTO product_categories (slug, name, parent_id, kind, description, sort_order) VALUES (?, ?, NULL, ?, ?, ?)",
      [top.slug, top.name, top.kind, top.description, i],
    );
    const [rows] = await p.query<mysql.RowDataPacket[]>(
      "SELECT id FROM product_categories WHERE slug = ?",
      [top.slug],
    );
    const parentId = rows[0]?.["id"];
    if (typeof parentId !== "number") continue;
    for (const [j, child] of top.children.entries()) {
      await p.query(
        "INSERT IGNORE INTO product_categories (slug, name, parent_id, kind, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        [child.slug, child.name, parentId, top.kind, child.description, j],
      );
    }
  }
}

let pool: mysql.Pool | undefined;
let schemaReady: Promise<void> | undefined;

async function ensureSchema(p: mysql.Pool) {
  for (const statement of SCHEMA) await p.query(statement);
  await migrate(p);
  await p.query("INSERT IGNORE INTO booking_settings (id, data) VALUES (1, ?)", [
    JSON.stringify(defaultBookingSettings),
  ]);
  await seedCategories(p);
}

export function isDbConfigured(): boolean {
  return dbConfig() !== null;
}

export async function getDb(): Promise<mysql.Pool> {
  const config = dbConfig();
  if (!config) throw new DatabaseNotConfiguredError();
  if (!pool) {
    pool = mysql.createPool({
      ...config,
      connectionLimit: 5,
      dateStrings: true, // keep DATE/DATETIME as plain strings, no time-zone shifting
      timezone: "Z",
      charset: "utf8mb4",
    });
  }
  if (!schemaReady) {
    schemaReady = ensureSchema(pool).catch((error: unknown) => {
      schemaReady = undefined; // retry on the next request
      throw error;
    });
  }
  await schemaReady;
  return pool;
}

export function isDuplicateKeyError(error: unknown, key?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; message?: string };
  if (e.code !== "ER_DUP_ENTRY") return false;
  return key ? (e.message ?? "").includes(key) : true;
}
