// Checkout flow: create our order + a Razorpay order, then confirm payment from the
// browser callback, the webhook, or a manual "check payment" in admin. Whichever
// arrives first marks the order paid; the others are no-ops.
import { buildOrderAdminAlert, buildOrderConfirmation, orderUrl } from "@/lib/order-emails";
import type { CheckoutSchema, OrderRecord } from "@/lib/order-types";
import type { z } from "zod";
import { getSettings } from "./bookings";
import { siteUrl } from "./env";
import { sendEmails } from "./mailer";
import * as orders from "./orders";
import {
  createRazorpayOrder,
  fetchOrderPayments,
  getRazorpayKeys,
  verifyPaymentSignature,
} from "./razorpay";

export const PAYMENTS_OFF =
  "Online payments are not switched on yet. Please message us on WhatsApp to order.";

export type StartCheckoutResult =
  | {
      ok: true;
      orderNumber: string;
      token: string;
      razorpay: { keyId: string; orderId: string; amount: number };
      customer: { name: string; email: string; phone: string };
    }
  | { ok: false; error: string };

export async function startCheckout(
  input: z.output<typeof CheckoutSchema>,
): Promise<StartCheckoutResult> {
  const keys = await getRazorpayKeys();
  if (!keys) return { ok: false, error: PAYMENTS_OFF };

  const settings = await orders.getShopSettings();
  const created = await orders.createPendingOrder(input, settings);
  if (!created.ok) return created;
  const { order, accessToken } = created;

  const rzp = await createRazorpayOrder(keys, order.totalPaise, order.orderNumber, {
    order_number: order.orderNumber,
  });
  await orders.setRazorpayOrderId(order.id, rzp.id);

  return {
    ok: true,
    orderNumber: order.orderNumber,
    token: accessToken,
    razorpay: { keyId: keys.keyId, orderId: rzp.id, amount: order.totalPaise },
    customer: { name: order.name, email: order.email, phone: order.phone },
  };
}

async function notifyPaid(order: OrderRecord) {
  const token = await orders.getAccessToken(order.id);
  if (!token) return;
  const link = orderUrl(siteUrl(), order, token);
  let adminEmail = "";
  try {
    adminEmail = (await getSettings()).adminNotificationEmail;
  } catch (e) {
    console.error("[checkout] could not load admin email", e);
  }
  await sendEmails([
    { message: buildOrderConfirmation(order, link) },
    ...(adminEmail
      ? [{ message: buildOrderAdminAlert(order, adminEmail), replyTo: order.email }]
      : []),
  ]);
}

// Shared by all three confirmation paths.
export async function recordPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  amountPaise: number,
): Promise<{ ok: true; order: OrderRecord } | { ok: false; error: string }> {
  const res = await orders.markOrderPaid(razorpayOrderId, razorpayPaymentId, amountPaise);
  if ("error" in res) return { ok: false, error: res.error };
  if (res.justPaid) {
    try {
      await notifyPaid(res.order);
    } catch (e) {
      console.error("[checkout] order emails failed", e);
    }
  }
  return { ok: true, order: res.order };
}

// Browser callback from Razorpay Checkout.
export async function confirmFromCheckout(p: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): Promise<{ ok: true; order: OrderRecord } | { ok: false; error: string }> {
  const keys = await getRazorpayKeys();
  if (!keys) return { ok: false, error: PAYMENTS_OFF };
  if (
    !verifyPaymentSignature(keys.keySecret, p.razorpayOrderId, p.razorpayPaymentId, p.signature)
  ) {
    return { ok: false, error: "We couldn't verify this payment. If money was taken, contact us." };
  }
  // A valid signature proves Razorpay took this payment for this Razorpay order, whose
  // amount we set from our own total. Prefer the amount Razorpay reports, if reachable.
  const order = await orders.getOrderByRazorpayId(p.razorpayOrderId);
  if (!order) return { ok: false, error: "Order not found." };
  const payments = await fetchOrderPayments(keys, p.razorpayOrderId).catch(() => []);
  const match = payments.find((x) => x.id === p.razorpayPaymentId);
  return recordPayment(p.razorpayOrderId, p.razorpayPaymentId, match?.amount ?? order.totalPaise);
}

// Asks Razorpay directly whether a pending order was paid (admin button, order page refresh).
export async function reconcile(order: OrderRecord): Promise<OrderRecord> {
  if (order.paymentStatus !== "pending" || !order.razorpayOrderId) return order;
  const keys = await getRazorpayKeys();
  if (!keys) return order;
  const payments = await fetchOrderPayments(keys, order.razorpayOrderId);
  const captured = payments.find((p) => p.status === "captured" || p.status === "authorized");
  if (!captured) return order;
  const res = await recordPayment(order.razorpayOrderId, captured.id, captured.amount);
  return res.ok ? res.order : order;
}
