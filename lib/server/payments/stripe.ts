import Stripe from "stripe";
import { env } from "@/lib/env";
import {
  WebhookSignatureError,
  type CreateSessionInput,
  type NormalizedPaymentEvent,
  type PaymentDriver,
} from "./types";

/** Pinned so a Stripe-side default change can never alter behaviour silently. */
export const STRIPE_API_VERSION = "2026-09-30.endive";

let client: Stripe | undefined;
function stripe(): Stripe {
  if (!client) {
    const key = env().STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { apiVersion: STRIPE_API_VERSION as Stripe.StripeConfig["apiVersion"], maxNetworkRetries: 2 });
  }
  return client;
}

function normalizeSession(id: string, type: string, session: Stripe.Checkout.Session): NormalizedPaymentEvent {
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const base = {
    id,
    rawType: type,
    sessionId: session.id,
    paymentIntentId: pi,
    amountCents: session.amount_total ?? undefined,
    currency: session.currency ?? undefined,
    bookingId: session.metadata?.bookingId ?? null,
    paymentId: session.metadata?.paymentId ?? null,
  };
  switch (type) {
    case "checkout.session.completed":
      return { ...base, kind: session.payment_status === "paid" ? "deposit_paid" : "ignored" };
    case "checkout.session.async_payment_succeeded":
      return { ...base, kind: "deposit_paid" };
    case "checkout.session.async_payment_failed":
      return { ...base, kind: "deposit_failed" };
    case "checkout.session.expired":
      return { ...base, kind: "session_expired" };
    default:
      return { ...base, kind: "ignored" };
  }
}

export const stripeDriver: PaymentDriver = {
  mode: "stripe",

  async createCheckoutSession(input: CreateSessionInput) {
    const session = await stripe().checkout.sessions.create(
      {
        ui_mode: "elements",
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amountCents,
              product_data: { name: input.description },
            },
          },
        ],
        customer_email: input.customerEmail ?? undefined,
        return_url: input.returnUrl,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        metadata: { bookingId: input.bookingId, paymentId: input.paymentId, bookingNumber: input.bookingNumber },
        payment_intent_data: {
          description: input.description,
          metadata: { bookingId: input.bookingId, paymentId: input.paymentId, bookingNumber: input.bookingNumber },
        },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    if (!session.client_secret) throw new Error("Stripe did not return a client_secret");
    return { sessionId: session.id, clientSecret: session.client_secret };
  },

  async expireSession(sessionId) {
    try {
      await stripe().checkout.sessions.expire(sessionId);
    } catch (err) {
      // Already complete/expired is fine — late payments are handled by the webhook.
      if (err instanceof Stripe.errors.StripeInvalidRequestError) return;
      throw err;
    }
  },

  async refund(input) {
    const refund = await stripe().refunds.create(
      { payment_intent: input.paymentIntentId, amount: input.amountCents, metadata: input.metadata },
      { idempotencyKey: input.idempotencyKey },
    );
    return { refundId: refund.id, status: refund.status ?? "pending" };
  },

  async parseWebhook(rawBody, headers) {
    const secret = env().STRIPE_WEBHOOK_SECRET;
    const signature = headers.get("stripe-signature");
    if (!secret || !signature) throw new WebhookSignatureError("missing signature");
    let event: Stripe.Event;
    try {
      event = await stripe().webhooks.constructEventAsync(rawBody, signature, secret);
    } catch (err) {
      throw new WebhookSignatureError((err as Error).message);
    }
    if (event.type.startsWith("checkout.session.")) {
      return normalizeSession(event.id, event.type, event.data.object as Stripe.Checkout.Session);
    }
    if (event.type === "refund.updated" || event.type === "refund.created") {
      const refund = event.data.object as Stripe.Refund;
      return {
        id: event.id,
        rawType: event.type,
        kind: "refund_updated",
        refundId: refund.id,
        refundStatus: refund.status ?? undefined,
        bookingId: refund.metadata?.bookingId ?? null,
      };
    }
    return { id: event.id, rawType: event.type, kind: "ignored" };
  },
};
