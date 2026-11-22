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
];

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
