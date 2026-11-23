// Order email templates. Pure functions; sending happens in src/server/mailer.ts.
import { brand } from "./brand";
import type { EmailMessage } from "./notifications";
import { type OrderRecord, formatAddress, FULFILMENT_LABEL } from "./order-types";
import { formatINR } from "./shop-types";
import { whatsappUrl, WHATSAPP_DISPLAY } from "./whatsapp";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function orderUrl(siteUrl: string, o: { orderNumber: string }, token: string): string {
  return `${siteUrl}/order/${encodeURIComponent(o.orderNumber)}?t=${encodeURIComponent(token)}`;
}

function itemLines(o: OrderRecord): string[] {
  return o.items.map((i) => `${i.qty} x ${i.name} - ${formatINR(i.unitPaise * i.qty)}`);
}

function totalsLines(o: OrderRecord): string[] {
  return [
    `Subtotal: ${formatINR(o.subtotalPaise)}`,
    ...(o.address ? [`Shipping: ${o.shippingPaise ? formatINR(o.shippingPaise) : "Free"}`] : []),
    `Total paid: ${formatINR(o.totalPaise)}`,
  ];
}

function nextSteps(o: OrderRecord): string[] {
  const kinds = new Set(o.items.map((i) => i.kind));
  const steps: string[] = [];
  if (kinds.has("ebook")) steps.push("Your e-books are ready to download from your order page.");
  if (kinds.has("course"))
    steps.push("Our team will email your course access details within 24 hours.");
  if (kinds.has("physical") || kinds.has("pharma"))
    steps.push("We'll email you again with tracking details once your parcel ships.");
  return steps;
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#2b2b26;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#2b2b26;padding:24px 28px;color:#f4f1ea;font-size:13px;letter-spacing:3px;font-weight:bold;">${esc(brand.nameUpper)}</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 16px;font-size:13px;color:#4f6b3a;font-weight:bold;letter-spacing:1px;">${heading}</p>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;background:#f4f1ea;font-size:12px;color:#77736a;">${esc(brand.tagline)}</td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(o: OrderRecord): string {
  const row = (k: string, v: string, bold = false, top = true) =>
    `<tr><td style="padding:10px 14px;${top ? "border-top:1px solid #e6e1d6;" : ""}">${k}</td><td align="right" style="padding:10px 14px;white-space:nowrap;${bold ? "font-weight:bold;" : ""}${top ? "border-top:1px solid #e6e1d6;" : ""}">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e1d6;border-radius:6px;font-size:14px;">
${o.items.map((i, n) => row(`${i.qty} &times; ${esc(i.name)}`, esc(formatINR(i.unitPaise * i.qty)), false, n > 0)).join("\n")}
${row("Subtotal", esc(formatINR(o.subtotalPaise)))}
${o.address ? row("Shipping", o.shippingPaise ? esc(formatINR(o.shippingPaise)) : "Free") : ""}
${row("<strong>Total paid</strong>", esc(formatINR(o.totalPaise)), true)}
</table>`;
}

export function buildOrderConfirmation(o: OrderRecord, link: string): EmailMessage {
  const first = o.name.split(" ")[0] ?? o.name;
  const steps = nextSteps(o);
  const text = [
    `Dear ${first},`,
    "",
    `Thank you for your order with ${brand.name}. We've received your payment.`,
    "",
    `ORDER ${o.orderNumber}`,
    ...itemLines(o),
    "",
    ...totalsLines(o),
    ...(o.address ? ["", "DELIVERY ADDRESS", formatAddress(o.address)] : []),
    "",
    ...steps,
    "",
    `View your order${o.items.some((i) => i.hasDownload) ? " and download your files" : ""}: ${link}`,
    "",
    `Questions? Reply to this email or message us on WhatsApp at ${WHATSAPP_DISPLAY}.`,
    "",
    "Warm regards,",
    `The ${brand.name} Team`,
  ].join("\n");

  const html = layout(
    "ORDER CONFIRMED &#10003;",
    `<p style="margin:0 0 16px;font-size:16px;">Dear ${esc(first)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Thank you for your order. We've received your payment for order <strong>${esc(o.orderNumber)}</strong>.</p>
${itemsTable(o)}
${o.address ? `<p style="margin:20px 0 4px;font-size:12px;color:#77736a;letter-spacing:1px;">DELIVERY ADDRESS</p><p style="margin:0;font-size:14px;line-height:1.5;">${esc(formatAddress(o.address)).replace(/\n/g, "<br>")}</p>` : ""}
${steps.map((s) => `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;">${esc(s)}</p>`).join("")}
<p style="margin:24px 0 0;"><a href="${esc(link)}" style="display:inline-block;background:#4f6b3a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;padding:12px 20px;border-radius:4px;">VIEW YOUR ORDER</a></p>
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;">Questions? Reply to this email or <a href="${whatsappUrl(`Hello ${brand.name}, regarding my order ${o.orderNumber}`)}" style="color:#4f6b3a;font-weight:bold;">message us on WhatsApp</a>.</p>
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;">Warm regards,<br><strong>The ${esc(brand.name)} Team</strong></p>`,
  );

  return {
    type: "ORDER_CONFIRMATION",
    to: o.email,
    subject: `Order confirmed: ${o.orderNumber} | ${brand.name}`,
    text,
    html,
  };
}

export function buildOrderAdminAlert(o: OrderRecord, adminEmail: string): EmailMessage {
  return {
    type: "ORDER_ADMIN_ALERT",
    to: adminEmail,
    subject: `[NEW ORDER] ${o.orderNumber} - ${formatINR(o.totalPaise)} - ${o.name}`,
    text: [
      "NEW PAID ORDER",
      "",
      `Order: ${o.orderNumber}`,
      `Customer: ${o.name}`,
      `Email: ${o.email}`,
      `Phone: ${o.phone}`,
      "",
      ...itemLines(o),
      "",
      ...totalsLines(o),
      `Razorpay payment: ${o.razorpayPaymentId ?? "-"}`,
      ...(o.address ? ["", "SHIP TO", formatAddress(o.address)] : []),
      ...(o.notes ? ["", `Customer note: ${o.notes}`] : []),
      "",
      "Open the admin portal (/admin > Orders) to process this order.",
    ].join("\n"),
  };
}

export function buildOrderStatusUpdate(o: OrderRecord, link: string): EmailMessage {
  const first = o.name.split(" ")[0] ?? o.name;
  const status = FULFILMENT_LABEL[o.fulfilmentStatus];
  const text = [
    `Dear ${first},`,
    "",
    `Your order ${o.orderNumber} has been ${status.toLowerCase()}.`,
    ...(o.trackingInfo ? ["", `Tracking: ${o.trackingInfo}`] : []),
    "",
    `View your order: ${link}`,
    "",
    "Warm regards,",
    `The ${brand.name} Team`,
  ].join("\n");
  const html = layout(
    `ORDER ${esc(status.toUpperCase())}`,
    `<p style="margin:0 0 16px;font-size:16px;">Dear ${esc(first)},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Your order <strong>${esc(o.orderNumber)}</strong> has been ${esc(status.toLowerCase())}.</p>
${o.trackingInfo ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;"><strong>Tracking:</strong> ${esc(o.trackingInfo)}</p>` : ""}
<p style="margin:8px 0 0;"><a href="${esc(link)}" style="display:inline-block;background:#4f6b3a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;padding:12px 20px;border-radius:4px;">VIEW YOUR ORDER</a></p>
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;">Warm regards,<br><strong>The ${esc(brand.name)} Team</strong></p>`,
  );
  return {
    type: "ORDER_SHIPPED",
    to: o.email,
    subject: `Your order ${o.orderNumber} has been ${status.toLowerCase()} | ${brand.name}`,
    text,
    html,
  };
}
