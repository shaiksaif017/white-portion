// Razorpay integration (server only). Keys are pasted by the owner in the admin portal
// and stored encrypted (see secrets.ts); the key secret never reaches the browser.
// Docs: https://razorpay.com/docs/payments/server-integration/
import { createHmac, timingSafeEqual } from "node:crypto";

import { getSecret, setSecret } from "./secrets";

const API = "https://api.razorpay.com/v1";
const KEY_ID = "razorpay_key_id";
const KEY_SECRET = "razorpay_key_secret";
const WEBHOOK_SECRET = "razorpay_webhook_secret";

export interface RazorpayKeys {
  keyId: string;
  keySecret: string;
}

export const KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{8,32}$/;

export async function getRazorpayKeys(): Promise<RazorpayKeys | null> {
  const [keyId, keySecret] = await Promise.all([getSecret(KEY_ID), getSecret(KEY_SECRET)]);
  return keyId && keySecret ? { keyId, keySecret } : null;
}

export async function saveRazorpayKeys(keys: RazorpayKeys): Promise<void> {
  await setSecret(KEY_ID, keys.keyId);
  await setSecret(KEY_SECRET, keys.keySecret);
}

export async function getWebhookSecret(): Promise<string | null> {
  return getSecret(WEBHOOK_SECRET);
}

export async function saveWebhookSecret(secret: string): Promise<void> {
  await setSecret(WEBHOOK_SECRET, secret);
}

export function keyMode(keyId: string): "test" | "live" {
  return keyId.startsWith("rzp_live_") ? "live" : "test";
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(
  keys: RazorpayKeys,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64")}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { description?: string };
  } & T;
  if (!res.ok) {
    throw new RazorpayError(
      json.error?.description ?? `Razorpay returned ${res.status}`,
      res.status,
    );
  }
  return json;
}

export async function createRazorpayOrder(
  keys: RazorpayKeys,
  amountPaise: number,
  receipt: string,
  notes: Record<string, string>,
): Promise<{ id: string; amount: number; currency: string }> {
  return call(keys, "POST", "/orders", {
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes,
  });
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
}

export async function fetchOrderPayments(
  keys: RazorpayKeys,
  razorpayOrderId: string,
): Promise<RazorpayPayment[]> {
  const res = await call<{ items: RazorpayPayment[] }>(
    keys,
    "GET",
    `/orders/${encodeURIComponent(razorpayOrderId)}/payments`,
  );
  return res.items ?? [];
}

// Checks the keys work without creating anything.
export async function testKeys(keys: RazorpayKeys): Promise<void> {
  await call(keys, "GET", "/orders?count=1");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

// Signature returned to the browser by Checkout after a successful payment.
export function verifyPaymentSignature(
  keySecret: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

// X-Razorpay-Signature header on webhook calls (HMAC of the raw body).
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
