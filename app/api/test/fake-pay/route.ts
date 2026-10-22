/**
 * Fake payment completion: builds a Stripe-shaped event and delivers it, signed, to
 * the real webhook route (optionally more than once, to test dedupe — scenario 9).
 */
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { business } from "@/config/business";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { siteUrl } from "@/lib/env";
import { FAKE_SIGNATURE_HEADER, signFakeBody, type FakeEventBody } from "@/lib/server/payments/fake";
import { notFound, testEndpointsEnabled } from "@/lib/server/test-mode";

const Body = z.object({
  sessionId: z.string().startsWith("fake_cs_"),
  outcome: z.enum(["success", "async_failed", "expired"]),
  deliveries: z.number().int().min(1).max(3).default(1),
  eventId: z.string().optional(),
});

export async function POST(request: Request) {
  if (!testEndpointsEnabled()) return notFound();
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "bad body" }, { status: 400 });
  const { sessionId, outcome, deliveries } = parsed.data;
  const [payment] = await getDb().select().from(s.payments).where(eq(s.payments.stripeCheckoutSessionId, sessionId));
  if (!payment) return Response.json({ error: "unknown session" }, { status: 404 });

  const event: FakeEventBody = {
    id: parsed.data.eventId ?? `evt_fake_${randomUUID()}`,
    type:
      outcome === "success"
        ? "checkout.session.completed"
        : outcome === "async_failed"
          ? "checkout.session.async_payment_failed"
          : "checkout.session.expired",
    session: {
      id: sessionId,
      payment_status: outcome === "success" ? "paid" : "unpaid",
      payment_intent: outcome === "success" ? `fake_pi_${payment.id.replace(/-/g, "")}` : null,
      amount_total: payment.amountCents,
      currency: business.currency.toLowerCase(),
      metadata: { bookingId: payment.bookingId, paymentId: payment.id },
    },
  };
  const body = JSON.stringify(event);
  const results = [];
  for (let i = 0; i < deliveries; i++) {
    const res = await fetch(`${siteUrl()}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [FAKE_SIGNATURE_HEADER]: signFakeBody(body) },
      body,
    });
    results.push({ status: res.status, body: await res.json().catch(() => null) });
  }
  return Response.json({ eventId: event.id, results });
}
