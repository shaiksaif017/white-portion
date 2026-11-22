// File storage in MySQL. Public files (product images) are served at /media/<id>;
// private files (e-books) are only released after a verified purchase.
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDb } from "./db";

const CHUNK = 512 * 1024;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
export const DOWNLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "application/zip": "zip",
};

// Checks the first bytes so a renamed file cannot pretend to be an image or PDF.
export function sniffMime(data: Buffer): string | null {
  const hex = data.subarray(0, 12).toString("hex");
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("52494646") && data.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (data.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (hex.startsWith("504b0304")) {
    // EPUB is a zip whose first entry is "mimetype" containing application/epub+zip
    return data.subarray(30, 58).toString("ascii").includes("mimetypeapplication/epub+zip")
      ? "application/epub+zip"
      : "application/zip";
  }
  return null;
}

export async function saveFile(
  name: string,
  mime: string,
  data: Buffer,
  isPublic: boolean,
): Promise<number> {
  const db = await getDb();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query<ResultSetHeader>(
      "INSERT INTO files (name, mime, size, is_public) VALUES (?, ?, ?, ?)",
      [name.slice(0, 255), mime, data.length, isPublic ? 1 : 0],
    );
    for (let i = 0, idx = 0; i < data.length; i += CHUNK, idx++) {
      await conn.query("INSERT INTO file_chunks (file_id, idx, data) VALUES (?, ?, ?)", [
        res.insertId,
        idx,
        data.subarray(i, i + CHUNK),
      ]);
    }
    await conn.commit();
    return res.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export interface StoredFile {
  id: number;
  name: string;
  mime: string;
  size: number;
  isPublic: boolean;
}

export async function getFileInfo(id: number): Promise<StoredFile | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, name, mime, size, is_public FROM files WHERE id = ?",
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r["id"]),
    name: String(r["name"]),
    mime: String(r["mime"]),
    size: Number(r["size"]),
    isPublic: Boolean(r["is_public"]),
  };
}

export async function readFileData(id: number): Promise<Buffer> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT data FROM file_chunks WHERE file_id = ? ORDER BY idx",
    [id],
  );
  return Buffer.concat(rows.map((r) => r["data"] as Buffer));
}

export async function deleteFiles(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.query("DELETE FROM file_chunks WHERE file_id IN (?)", [ids]);
  await db.query("DELETE FROM files WHERE id IN (?)", [ids]);
}
