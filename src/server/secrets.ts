// Small encrypted key/value store in MySQL for secrets the owner sets from the admin
// portal (currently: the email account password). Values are encrypted with
// AES-256-GCM using a key derived from SESSION_SECRET, so a copy of the database
// alone does not reveal them. Secrets are never sent to the browser.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";

import { getDb } from "./db";
import { authConfig } from "./env";

function key(): Buffer | null {
  const config = authConfig();
  if (!config) return null;
  return createHash("sha256").update(`wpw-secrets|${config.sessionSecret}`).digest();
}

export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) throw new Error("SESSION_SECRET is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${data.toString("hex")}`;
}

export function decryptSecret(stored: string): string | null {
  const k = key();
  const [version, ivHex, tagHex, dataHex] = stored.split(":");
  if (!k || version !== "v1" || !ivHex || !tagHex || dataHex === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null; // wrong key (SESSION_SECRET changed) or tampered value
  }
}

export async function getSecret(name: string): Promise<string | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT value FROM app_secrets WHERE name = ?", [
    name,
  ]);
  const raw = rows[0]?.["value"];
  return typeof raw === "string" ? decryptSecret(raw) : null;
}

export async function setSecret(name: string, value: string): Promise<void> {
  const db = await getDb();
  await db.query(
    "INSERT INTO app_secrets (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [name, encryptSecret(value)],
  );
}
