import { after } from "next/server";
import { handlePaymentEvent } from "@/lib/server/booking/checkout";
import { now } from "@/lib/server/clock";
import { flushOutbox } from "@/lib/server/jobs";
import { paymentDriver } from "@/lib/server/payments";
import { WebhookSignatureError } from "@/lib/server/payments/types";

export async function POST(request: Request) {
  const driver = paymentDriver();
  if (!driver) return Response.json({ error: "payments not configured" }, { status: 503 });
  const raw = await request.text();
  let event;
  try {
    event = await driver.parseWebhook(raw, request.headers);
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      console.warn("[webhook] rejected:", err.message);
      return Response.json({ error: "invalid signature" }, { status: 400 });
    }
    throw err;
  }
  try {
    const result = await handlePaymentEvent(event, new Date(now()));
    after(() => flushOutbox().catch((e) => console.error("[after] flush failed", e)));
    return Response.json({ received: true, ...result });
  } catch (err) {
    console.error("[webhook] processing failed", err);
    // 500 → Stripe retries; the event row records the error and dedupe still applies.
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
}
