// Server-only configuration. Values come from environment variables:
// on Hostinger they are set in hPanel (Web App -> Environment variables);
// locally they come from a git-ignored `.env` file (see `.env.example`).
import { existsSync } from "node:fs";

let loaded = false;

function loadLocalEnvFile() {
  if (loaded) return;
  loaded = true;
  if (process.env["NODE_ENV"] === "production") return;
  try {
    if (existsSync(".env")) process.loadEnvFile(".env");
  } catch (error) {
    console.warn("[env] Could not read .env file", error);
  }
}

function read(name: string): string | undefined {
  loadLocalEnvFile();
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function dbConfig() {
  const host = read("DB_HOST");
  const user = read("DB_USER");
  const password = read("DB_PASSWORD");
  const database = read("DB_NAME");
  if (!host || !user || !password || !database) return null;
  return { host, user, password, database, port: Number(read("DB_PORT") ?? 3306) };
}

export function authConfig() {
  const passwordHash = read("ADMIN_PASSWORD_HASH");
  const sessionSecret = read("SESSION_SECRET");
  if (!passwordHash || !sessionSecret || sessionSecret.length < 32) return null;
  return { passwordHash, sessionSecret };
}

export function smtpConfig() {
  const host = read("SMTP_HOST");
  const user = read("SMTP_USER");
  const pass = read("SMTP_PASS");
  if (!host || !user || !pass) return null;
  const port = Number(read("SMTP_PORT") ?? 465);
  return { host, port, user, pass, from: read("MAIL_FROM") ?? user };
}

export function isProduction() {
  return process.env["NODE_ENV"] === "production";
}
