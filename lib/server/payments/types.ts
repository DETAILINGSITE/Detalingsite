export interface CreateSessionInput {
  bookingId: string;
  paymentId: string;
  bookingNumber: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail?: string | null;
  returnUrl: string;
  /** Stripe requires ≥ 30 minutes; we expire it ourselves earlier when the hold lapses. */
  expiresAt: Date;
  idempotencyKey: string;
}

export interface NormalizedPaymentEvent {
  id: string;
  kind: "deposit_paid" | "deposit_failed" | "session_expired" | "refund_updated" | "ignored";
  rawType: string;
  sessionId?: string;
  paymentIntentId?: string | null;
  amountCents?: number;
  currency?: string;
  bookingId?: string | null;
  paymentId?: string | null;
  refundId?: string;
  refundStatus?: string;
}

export interface PaymentDriver {
  mode: "stripe" | "fake";
  createCheckoutSession(input: CreateSessionInput): Promise<{ sessionId: string; clientSecret: string }>;
  expireSession(sessionId: string): Promise<void>;
  refund(input: {
    paymentIntentId: string;
    amountCents: number;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<{ refundId: string; status: string }>;
  /** Verifies the signature and normalises the event. Throws on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<NormalizedPaymentEvent>;
}

export class WebhookSignatureError extends Error {}
