/**
 * Fake payment provider for development and automated tests (PAYMENTS_DRIVER=fake).
 * It never moves money. The test payment panel posts an outcome to /api/test/fake-pay,
 * which builds a Stripe-shaped event, signs it with an HMAC and delivers it to the
 * REAL webhook route — so the webhook path, dedupe and late-payment logic all run.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { WebhookSignatureError, type NormalizedPaymentEvent, type PaymentDriver } from "./types";

export const FAKE_SIGNATURE_HEADER = "x-fake-signature";

export function signFakeBody(body: string): string {
  return createHmac("sha256", `fake-webhook:${env().TOKEN_PEPPER}`).update(body).digest("hex");
}

export interface FakeEventBody {
  id: string;
  type: "checkout.session.completed" | "checkout.session.async_payment_failed" | "checkout.session.expired" | "refund.updated";
  session?: {
    id: string;
    payment_status: "paid" | "unpaid";
    payment_intent: string | null;
    amount_total: number;
    currency: string;
    metadata: { bookingId: string; paymentId: string };
  };
  refund?: { id: string; status: string; bookingId?: string };
}

export const fakeDriver: PaymentDriver = {
  mode: "fake",

  async createCheckoutSession(input) {
    const id = `fake_cs_${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 24)}`;
    return { sessionId: id, clientSecret: `${id}_secret` };
  },

  async expireSession() {
    // nothing to do
  },

  async refund(input) {
    const id = `fake_re_${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 24)}`;
    return { refundId: id, status: "succeeded" };
  },

  async parseWebhook(rawBody, headers): Promise<NormalizedPaymentEvent> {
    const sig = headers.get(FAKE_SIGNATURE_HEADER) ?? "";
    const expected = signFakeBody(rawBody);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookSignatureError("bad fake signature");
    const body = JSON.parse(rawBody) as FakeEventBody;
    if (body.type === "refund.updated" && body.refund) {
      return {
        id: body.id,
        rawType: body.type,
        kind: "refund_updated",
        refundId: body.refund.id,
        refundStatus: body.refund.status,
        bookingId: body.refund.bookingId ?? null,
      };
    }
    const sess = body.session;
    if (!sess) return { id: body.id, rawType: body.type, kind: "ignored" };
    const base = {
      id: body.id,
      rawType: body.type,
      sessionId: sess.id,
      paymentIntentId: sess.payment_intent,
      amountCents: sess.amount_total,
      currency: sess.currency,
      bookingId: sess.metadata.bookingId,
      paymentId: sess.metadata.paymentId,
    };
    if (body.type === "checkout.session.completed")
      return { ...base, kind: sess.payment_status === "paid" ? "deposit_paid" : "ignored" };
    if (body.type === "checkout.session.async_payment_failed") return { ...base, kind: "deposit_failed" };
    return { ...base, kind: "session_expired" };
  },
};
