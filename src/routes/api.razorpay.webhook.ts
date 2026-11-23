// Razorpay webhook: confirms payments even if the customer closes the browser before
// returning to the site. Set it up in Razorpay Dashboard > Settings > Webhooks with
// this URL, the same secret as in Admin > Orders > Payment settings, and the events
// "payment.captured" and "order.paid".
import { createFileRoute } from "@tanstack/react-router";

import { recordPayment } from "@/server/checkout";
import { getWebhookSecret, verifyWebhookSignature } from "@/server/razorpay";

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } };
  };
}

export const Route = createFileRoute("/api/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 200_000) return new Response("Too large", { status: 413 });
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        try {
          const secret = await getWebhookSecret();
          if (!secret || !verifyWebhookSignature(secret, raw, signature)) {
            return new Response("Invalid signature", { status: 401 });
          }
          const body = JSON.parse(raw) as WebhookBody;
          const p = body.payload?.payment?.entity;
          if (
            (body.event === "payment.captured" || body.event === "order.paid") &&
            p?.id &&
            p.order_id &&
            typeof p.amount === "number"
          ) {
            const res = await recordPayment(p.order_id, p.id, p.amount);
            // Unknown orders (e.g. payments from another website on the same account) are ignored.
            if (!res.ok) console.warn("[webhook]", body.event, p.order_id, res.error);
          }
          return new Response("ok");
        } catch (error) {
          console.error("[webhook] failed", error);
          // 5xx makes Razorpay retry later.
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
