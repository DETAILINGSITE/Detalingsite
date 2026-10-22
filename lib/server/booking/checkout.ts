/**
 * Contact → review/pay → confirmation (docs/PLAN.md §4.2). A booking becomes
 * CONFIRMED only here: via the payment webhook, or immediately when no deposit is due.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { business } from "@/config/business";
import { EXCLUSION_VIOLATION, UNIQUE_VIOLATION, getDb, pgErrorCode, retryOnDeadlock, type Db, type Queryable } from "@/db/client";
import * as s from "@/db/schema";
import { blockedRange } from "@/lib/domain/availability";
import { price } from "@/lib/domain/pricing";
import { MINUTE } from "@/lib/domain/time";
import { env, siteUrl } from "@/lib/env";
import type { ContactData } from "@/lib/validation/booking";
import { recordFunnel } from "../funnel";
import { enqueueBookingConfirmed, enqueueLatePaymentRefunded, ownerAlert } from "../notify/enqueue";
import { enqueue } from "../outbox";
import { paymentDriver } from "../payments";
import type { NormalizedPaymentEvent } from "../payments/types";
import { eligibleResourceIds, loadBookingContext } from "./context";
import { activeAllocation, loadLiveHold, manageTokenFor } from "./holds";
import { checkPromo, pricingContext, quoteTermsFrom, redeemPromo } from "./pricing";
import { transition } from "./transition";

type Booking = typeof s.bookings.$inferSelect;

// ── Step 6: contact ──────────────────────────────────────────────────────────

export async function upsertCustomer(
  db: Queryable,
  contact: ContactData,
  meta: { ip: string | null; now: Date },
): Promise<typeof s.customers.$inferSelect> {
  const consent = contact.smsConsent
    ? {
        smsConsentAt: meta.now,
        smsConsentTextVersion: business.smsConsent.version,
        smsConsentIp: meta.ip && meta.ip !== "0.0.0.0" ? meta.ip : null,
        smsOptOutAt: null,
      }
    : {};
  const [row] = await db
    .insert(s.customers)
    .values({
      name: contact.name,
      email: contact.email,
      phoneE164: contact.phone,
      preferredContact: contact.preferredContact,
      createdAt: meta.now,
      updatedAt: meta.now,
      ...consent,
    })
    .onConflictDoUpdate({
      target: s.customers.email,
      targetWhere: sql`anonymized_at IS NULL`,
      set: {
        name: contact.name,
        phoneE164: contact.phone,
        preferredContact: contact.preferredContact,
        updatedAt: meta.now,
        ...consent,
      },
    })
    .returning();
  if (!row) throw new Error("customer upsert failed");
  return row;
}

export async function attachContact(
  token: string,
  contact: ContactData,
  meta: { ip: string | null; now: Date; sessionId: string },
  db: Db = getDb(),
) {
  const live = await loadLiveHold(db, token, meta.now);
  if (!live.ok) return { ok: false as const, code: live.code };
  await db.transaction(async (tx) => {
    const customer = await upsertCustomer(tx, contact, meta);
    await tx
      .update(s.bookings)
      .set({
        customerId: customer.id,
        heardAbout: contact.heardAbout ?? null,
        leadConsentAt: contact.leadConsent ? meta.now : null,
        updatedAt: meta.now,
      })
      .where(eq(s.bookings.id, live.booking.id));
    await tx.insert(s.bookingEvents).values({
      bookingId: live.booking.id,
      type: "contact_attached",
      actor: "customer",
      data: { smsConsent: contact.smsConsent, leadConsent: contact.leadConsent },
      createdAt: meta.now,
    });
  });
  await recordFunnel(db, { sessionId: meta.sessionId, event: "step_complete", step: "contact", bookingId: live.booking.id, at: meta.now });
  return { ok: true as const };
}

// ── Step 7: review & pay ─────────────────────────────────────────────────────

export type StartPaymentResult =
  | { ok: true; kind: "confirmed"; token: string }
  | {
      ok: true;
      kind: "payment";
      clientSecret: string;
      sessionId: string;
      amountCents: number;
      holdExpiresAt: string;
      driver: "stripe" | "fake";
    }
  | { ok: false; code: "PRICE_CHANGED"; message: string; totalCents: number; depositCents: number }
  | { ok: false; code: "PROMO_INVALID"; message: string }
  | { ok: false; code: "NOT_FOUND" | "NOT_HELD" | "HOLD_EXPIRED" | "NO_CONTACT" | "PAYMENT_ERROR"; message: string };

export async function startPayment(
  token: string,
  input: { promoCode?: string; expectedTotalCents: number; sessionId: string },
  now: Date,
  db: Db = getDb(),
): Promise<StartPaymentResult> {
  const live = await loadLiveHold(db, token, now);
  if (!live.ok) {
    if (live.code === "NOT_HELD" && live.booking?.status === "confirmed")
      return { ok: true, kind: "confirmed", token };
    return {
      ok: false,
      code: live.code,
      message:
        live.code === "HOLD_EXPIRED"
          ? "Your hold on that time expired. Please choose a time again."
          : "We couldn't find that booking.",
    };
  }
  const booking = live.booking;
  if (!booking.customerId) return { ok: false, code: "NO_CONTACT", message: "Please add your contact details first." };

  // Re-price server-side (catalog may have changed; promo applied here).
  const ctx = await loadBookingContext(db);
  let promo = null;
  if (input.promoCode) {
    const check = await checkPromo(db, input.promoCode, now, booking.customerId);
    if (!check.ok) return { ok: false, code: "PROMO_INVALID", message: check.message };
    promo = check.promo;
  }
  let quote = null;
  if (booking.quoteRequestId) {
    const [q] = await db.select().from(s.quoteRequests).where(eq(s.quoteRequests.id, booking.quoteRequestId));
    if (q) quote = quoteTermsFrom(q);
  }
  const zone = ctx.schedule.zones.find((z) => z.id === booking.zoneId) ?? null;
  const result = price(
    { ...booking.selection, locationType: booking.locationType },
    pricingContext(ctx, { zone, promo, quote }),
  );
  if (!result.ok || result.durationMin !== booking.durationMin) {
    return {
      ok: false,
      code: "HOLD_EXPIRED",
      message: "Something about this job changed. Please pick your time again so we can recheck availability.",
    };
  }
  if (result.totalCents !== input.expectedTotalCents) {
    // Persist the new snapshot so the client re-renders the exact figures it must accept.
    await db
      .update(s.bookings)
      .set({ priceSnapshot: { ...booking.priceSnapshot, ...result, computedAt: now.toISOString() }, updatedAt: now })
      .where(eq(s.bookings.id, booking.id));
    return {
      ok: false,
      code: "PRICE_CHANGED",
      message: "The price changed since you started. Please review the new total.",
      totalCents: result.totalCents,
      depositCents: result.depositCents,
    };
  }

  const priceFields = {
    priceSnapshot: { ...booking.priceSnapshot, ...result, computedAt: now.toISOString() },
    subtotalCents: result.subtotalCents,
    surchargeCents: result.surchargeCents,
    travelFeeCents: result.travelFeeCents,
    discountCents: result.discountCents,
    taxCents: result.taxCents,
    totalCents: result.totalCents,
    depositCents: result.depositCents,
    promoCodeId: promo?.id ?? null,
  };

  // No deposit due → confirm immediately (scenario 16).
  const driver = paymentDriver();
  if (result.depositCents === 0 || !driver) {
    const confirmed = await db.transaction(async (tx) => {
      const row = await transition(tx, {
        bookingId: booking.id,
        event: "confirm_no_deposit",
        actor: "customer",
        at: now,
        set: { ...priceFields, depositCents: 0, confirmedAt: now },
      });
      if (!row) return null;
      await finalizeConfirmation(tx, row, ctx.settings, now);
      return row;
    });
    if (!confirmed) return { ok: false, code: "NOT_HELD", message: "This booking can't be confirmed anymore." };
    await recordFunnel(db, { sessionId: input.sessionId, event: "confirmed", step: "review", bookingId: booking.id, at: now });
    return { ok: true, kind: "confirmed", token };
  }

  // Deposit due → (re)use a Checkout Session.
  const holdUntil = new Date(now.getTime() + ctx.settings.paymentHoldMinutes * MINUTE);
  const prepared = await db.transaction(async (tx) => {
    await tx.update(s.bookings).set({ ...priceFields, updatedAt: now }).where(eq(s.bookings.id, booking.id));
    await tx
      .update(s.resourceAllocations)
      .set({ holdExpiresAt: holdUntil, updatedAt: now })
      .where(eq(s.resourceAllocations.id, live.alloc.id));
    const [last] = await tx
      .select()
      .from(s.payments)
      .where(and(eq(s.payments.bookingId, booking.id), eq(s.payments.kind, "deposit")))
      .orderBy(desc(s.payments.attempt))
      .limit(1);
    if (last && last.status === "open" && last.amountCents === result.depositCents) return last;
    if (last?.status === "open" && last.stripeCheckoutSessionId) {
      await tx.update(s.payments).set({ status: "cancelled", updatedAt: now }).where(eq(s.payments.id, last.id));
      await enqueue(tx, {
        type: "stripe.expire_session",
        payload: { paymentId: last.id, sessionId: last.stripeCheckoutSessionId },
        runAt: now,
        dedupeKey: `payment:${last.id}:expire`,
        bookingId: booking.id,
      });
    }
    const attempt = (last?.attempt ?? 0) + 1;
    const [p] = await tx
      .insert(s.payments)
      .values({
        bookingId: booking.id,
        kind: "deposit",
        method: "stripe",
        amountCents: result.depositCents,
        status: "open",
        attempt,
        idempotencyKey: `deposit:${booking.id}:${attempt}`,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return p!;
  });

  let session = prepared.stripeCheckoutSessionId
    ? { sessionId: prepared.stripeCheckoutSessionId, clientSecret: (prepared.raw as { clientSecret?: string }).clientSecret ?? "" }
    : null;
  if (!session || !session.clientSecret) {
    const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, booking.customerId));
    try {
      session = await driver.createCheckoutSession({
        bookingId: booking.id,
        paymentId: prepared.id,
        bookingNumber: booking.number,
        amountCents: result.depositCents,
        currency: business.currency,
        description: `Deposit — ${business.name} booking ${booking.number}`,
        customerEmail: customer?.email ?? null,
        returnUrl: `${siteUrl()}/book/return?t=${encodeURIComponent(token)}&session_id={CHECKOUT_SESSION_ID}`,
        expiresAt: new Date(now.getTime() + 31 * MINUTE),
        idempotencyKey: prepared.idempotencyKey,
      });
    } catch (err) {
      console.error("[payments] createCheckoutSession failed", err);
      return { ok: false, code: "PAYMENT_ERROR", message: "We couldn't start the payment. Please try again in a moment." };
    }
    await db
      .update(s.payments)
      .set({ stripeCheckoutSessionId: session.sessionId, raw: { clientSecret: session.clientSecret }, updatedAt: now })
      .where(eq(s.payments.id, prepared.id));
  }

  await db.transaction(async (tx) => {
    await transition(tx, {
      bookingId: booking.id,
      event: "start_payment",
      actor: "customer",
      at: now,
      data: { paymentId: prepared.id, attempt: prepared.attempt },
    });
  });
  await recordFunnel(db, { sessionId: input.sessionId, event: "payment_started", step: "review", bookingId: booking.id, at: now });

  return {
    ok: true,
    kind: "payment",
    clientSecret: session.clientSecret,
    sessionId: session.sessionId,
    amountCents: result.depositCents,
    holdExpiresAt: holdUntil.toISOString(),
    driver: driver.mode,
  };
}

/** Shared post-confirmation work, inside the confirming transaction. */
async function finalizeConfirmation(
  tx: Queryable,
  booking: Booking,
  settings: Awaited<ReturnType<typeof loadBookingContext>>["settings"],
  now: Date,
) {
  await tx
    .update(s.resourceAllocations)
    .set({ holdExpiresAt: null, updatedAt: now })
    .where(and(eq(s.resourceAllocations.bookingId, booking.id), eq(s.resourceAllocations.active, true)));
  if (booking.promoCodeId) {
    const ok = await redeemPromo(tx, booking.promoCodeId);
    if (!ok) {
      await ownerAlert(tx, {
        key: `booking:${booking.id}:promo_cap`,
        now,
        bookingId: booking.id,
        subject: `Promo cap exceeded — ${booking.number}`,
        body: "A promo code reached its redemption cap while this booking was paying. The discount was honoured.",
      });
    }
  }
  if (booking.quoteRequestId) {
    await tx
      .update(s.quoteRequests)
      .set({ status: "accepted", bookingId: booking.id, respondedAt: now, updatedAt: now })
      .where(and(eq(s.quoteRequests.id, booking.quoteRequestId), eq(s.quoteRequests.status, "quoted")));
  }
  // A lead created by an earlier abandoned attempt is now won.
  if (booking.customerId) {
    await tx
      .update(s.leads)
      .set({ status: "won", updatedAt: now })
      .where(and(eq(s.leads.customerId, booking.customerId), eq(s.leads.source, "booking_abandoned"), eq(s.leads.status, "new")));
  }
  await enqueueBookingConfirmed(tx, booking, settings, now);
}

// ── Payment webhooks ─────────────────────────────────────────────────────────

export async function handlePaymentEvent(event: NormalizedPaymentEvent, now: Date, db: Db = getDb()) {
  // Dedupe by provider event id (scenario 9).
  const inserted = await db
    .insert(s.webhookEvents)
    .values({ id: event.id, provider: "stripe", type: event.rawType, receivedAt: now })
    .onConflictDoNothing()
    .returning({ id: s.webhookEvents.id });
  if (inserted.length === 0) {
    const [prev] = await db.select().from(s.webhookEvents).where(eq(s.webhookEvents.id, event.id));
    if (prev?.processedAt) return { status: "duplicate" as const };
  }
  try {
    let outcome: string = "ignored";
    if (event.kind === "deposit_paid") outcome = await onDepositPaid(db, event, now);
    else if (event.kind === "deposit_failed" || event.kind === "session_expired")
      outcome = await onDepositNotPaid(db, event, now);
    else if (event.kind === "refund_updated") outcome = await onRefundUpdated(db, event, now);
    await db
      .update(s.webhookEvents)
      .set({ processedAt: now, error: null })
      .where(eq(s.webhookEvents.id, event.id));
    return { status: "processed" as const, outcome };
  } catch (err) {
    await db
      .update(s.webhookEvents)
      .set({ error: (err as Error).message.slice(0, 1000) })
      .where(eq(s.webhookEvents.id, event.id));
    throw err;
  }
}

async function onDepositPaid(db: Db, event: NormalizedPaymentEvent, now: Date): Promise<string> {
  if (!event.sessionId) return "no_session";
  const ctx = await loadBookingContext(db);
  return retryOnDeadlock(() => db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(s.payments)
      .where(eq(s.payments.stripeCheckoutSessionId, event.sessionId!))
      .for("update");
    if (!payment) {
      await ownerAlert(tx, {
        key: `webhook:${event.id}:unknown`,
        now,
        subject: "Payment received for an unknown booking",
        body: `Checkout session ${event.sessionId} was paid but no booking matches it. Check Stripe.`,
      });
      return "unknown_payment";
    }
    if (payment.status === "succeeded") return "already_succeeded";
    if (
      event.amountCents !== payment.amountCents ||
      (event.currency && event.currency.toLowerCase() !== business.currency.toLowerCase())
    ) {
      await ownerAlert(tx, {
        key: `payment:${payment.id}:mismatch`,
        now,
        bookingId: payment.bookingId,
        subject: "Payment amount mismatch",
        body: `Session ${event.sessionId} paid ${event.amountCents} ${event.currency} but ${payment.amountCents} was expected. The booking was not confirmed automatically.`,
      });
      return "amount_mismatch";
    }

    // Belt and braces: never two paid deposits for one booking (two tabs).
    const [other] = await tx
      .select({ id: s.payments.id })
      .from(s.payments)
      .where(and(eq(s.payments.bookingId, payment.bookingId), eq(s.payments.kind, "deposit"), eq(s.payments.status, "succeeded")));
    if (other) {
      await tx
        .update(s.payments)
        .set({ status: "cancelled", stripePaymentIntentId: event.paymentIntentId ?? null, note: "Duplicate deposit — refunded", updatedAt: now })
        .where(eq(s.payments.id, payment.id));
      await queueRefund(tx, payment.bookingId, payment.id, event.paymentIntentId, payment.amountCents, "duplicate", now);
      return "duplicate_refunded";
    }

    try {
      await tx.transaction(async (sp) => {
        await sp
          .update(s.payments)
          .set({ status: "succeeded", stripePaymentIntentId: event.paymentIntentId ?? null, updatedAt: now })
          .where(eq(s.payments.id, payment.id));
      });
    } catch (err) {
      if (pgErrorCode(err) !== UNIQUE_VIOLATION) throw err;
      await queueRefund(tx, payment.bookingId, payment.id, event.paymentIntentId, payment.amountCents, "duplicate", now);
      return "duplicate_refunded";
    }

    const [booking] = await tx.select().from(s.bookings).where(eq(s.bookings.id, payment.bookingId)).for("update");
    if (!booking) return "no_booking";

    if (booking.status === "pending_payment" || booking.status === "held") {
      if (booking.status === "held") {
        // Payment raced ahead of our own state change; walk the machine forward.
        await transition(tx, { bookingId: booking.id, event: "start_payment", actor: "stripe", at: now });
      }
      const row = await transition(tx, {
        bookingId: booking.id,
        event: "payment_succeeded",
        actor: "stripe",
        at: now,
        data: { paymentId: payment.id, eventId: event.id },
        set: { confirmedAt: now },
      });
      if (row) await finalizeConfirmation(tx, row, ctx.settings, now);
      return "confirmed";
    }

    if (booking.status === "expired") {
      // Late payment (docs/PLAN.md §4.2): re-acquire the same period if it's still free.
      const reacquired = await reacquire(tx, booking, ctx, now);
      if (reacquired) {
        const row = await transition(tx, {
          bookingId: booking.id,
          event: "late_payment_reacquired",
          actor: "stripe",
          at: now,
          data: { paymentId: payment.id },
          set: { confirmedAt: now },
        });
        if (row) await finalizeConfirmation(tx, row, ctx.settings, now);
        return "late_confirmed";
      }
      await queueRefund(tx, booking.id, payment.id, event.paymentIntentId, payment.amountCents, "slot_lost", now);
      await enqueueLatePaymentRefunded(tx, booking, now);
      return "late_refunded";
    }

    if (booking.status === "cancelled") {
      await queueRefund(tx, booking.id, payment.id, event.paymentIntentId, payment.amountCents, "booking_cancelled", now);
      return "cancelled_refunded";
    }
    return "noop";
  }));
}

async function reacquire(
  tx: Queryable,
  booking: Booking,
  ctx: Awaited<ReturnType<typeof loadBookingContext>>,
  now: Date,
): Promise<boolean> {
  const zone = ctx.schedule.zones.find((z) => z.id === booking.zoneId);
  const travel = booking.locationType === "mobile" ? (zone?.travelMinutes ?? 0) : 0;
  const blocked = blockedRange(booking.startsAt.getTime(), booking.durationMin, travel, ctx.settings.bufferMin);
  if (booking.startsAt.getTime() <= now.getTime()) return false;
  for (const resourceId of eligibleResourceIds(ctx, booking.locationType)) {
    try {
      await tx.transaction(async (sp) => {
        await sp.insert(s.resourceAllocations).values({
          resourceId,
          kind: "booking",
          bookingId: booking.id,
          period: { start: new Date(blocked.start), end: new Date(blocked.end) },
          active: true,
          holdExpiresAt: null,
          createdAt: now,
          updatedAt: now,
        });
      });
      return true;
    } catch (err) {
      if (pgErrorCode(err) === EXCLUSION_VIOLATION) continue;
      throw err;
    }
  }
  return false;
}

export async function queueRefund(
  db: Queryable,
  bookingId: string,
  paymentId: string,
  paymentIntentId: string | null | undefined,
  amountCents: number,
  reason: string,
  now: Date,
) {
  if (amountCents <= 0) return;
  await enqueue(db, {
    type: "stripe.refund",
    payload: { bookingId, paymentId, paymentIntentId: paymentIntentId ?? null, amountCents, reason },
    runAt: now,
    dedupeKey: `refund:${bookingId}:${paymentId}:${reason}`,
    bookingId,
    maxAttempts: 10,
  });
}

async function onDepositNotPaid(db: Db, event: NormalizedPaymentEvent, now: Date) {
  if (!event.sessionId) return "no_session";
  const rows = await db
    .update(s.payments)
    .set({ status: event.kind === "deposit_failed" ? "failed" : "expired", updatedAt: now })
    .where(and(eq(s.payments.stripeCheckoutSessionId, event.sessionId), eq(s.payments.status, "open")))
    .returning({ bookingId: s.payments.bookingId });
  return rows.length ? "payment_closed" : "noop";
}

async function onRefundUpdated(db: Db, event: NormalizedPaymentEvent, now: Date) {
  if (!event.refundId) return "noop";
  const status = event.refundStatus === "succeeded" ? "refunded" : event.refundStatus === "failed" ? "failed" : null;
  if (!status) return "noop";
  await db
    .update(s.payments)
    .set({ status, updatedAt: now })
    .where(eq(s.payments.stripeRefundId, event.refundId));
  return "refund_updated";
}

/** Used by /book/return and the confirmation poll. */
export async function bookingStatusForToken(token: string, db: Db = getDb()) {
  const { findBookingByToken } = await import("./holds");
  const booking = await findBookingByToken(db, token);
  if (!booking) return null;
  const alloc = await activeAllocation(db, booking.id);
  return {
    status: booking.status,
    number: booking.number,
    holdExpiresAt: alloc?.holdExpiresAt?.toISOString() ?? null,
    manageToken: manageTokenFor(booking.id, booking.manageTokenVersion),
  };
}

/** Exposed for tests: the env pepper must be set before tokens are derived. */
export const _internal = { env };
