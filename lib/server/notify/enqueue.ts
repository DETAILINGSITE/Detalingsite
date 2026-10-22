/**
 * Enqueues customer/owner notifications. Recipients and content are resolved at send
 * time (lib/server/notify/handlers.ts) so a message always reflects the current booking.
 */
import { eq } from "drizzle-orm";
import { business } from "@/config/business";
import type { Queryable } from "@/db/client";
import * as s from "@/db/schema";
import { planReminders } from "@/lib/domain/notifications";
import type { OperationalSettings } from "@/lib/domain/settings";
import { HOUR } from "@/lib/domain/time";
import { cancelPending, enqueue } from "../outbox";

export type EmailTemplate =
  | "booking_confirmed"
  | "booking_reminder"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "late_payment_refunded"
  | "review_request"
  | "owner_booking_confirmed"
  | "owner_booking_cancelled"
  | "owner_booking_rescheduled"
  | "owner_alert"
  | "quote_received"
  | "quote_sent"
  | "owner_new_quote"
  | "owner_new_lead"
  | "contact_received";

export type Audience = "customer" | "owner";

type Booking = typeof s.bookings.$inferSelect;
type Customer = typeof s.customers.$inferSelect;

export function canTextCustomer(c: Pick<Customer, "smsConsentAt" | "smsOptOutAt" | "phoneE164"> | null | undefined) {
  return Boolean(c?.phoneE164 && c.smsConsentAt && !c.smsOptOutAt);
}

async function both(
  db: Queryable,
  args: {
    template: EmailTemplate;
    audience: Audience;
    key: string;
    runAt: Date;
    bookingId?: string;
    quoteRequestId?: string;
    leadId?: string;
    sms: boolean;
    smsRunAt?: Date | null;
    data?: Record<string, unknown>;
  },
) {
  const payload = {
    template: args.template,
    audience: args.audience,
    bookingId: args.bookingId ?? null,
    quoteRequestId: args.quoteRequestId ?? null,
    leadId: args.leadId ?? null,
    data: args.data ?? {},
  };
  const links = { bookingId: args.bookingId, quoteRequestId: args.quoteRequestId, leadId: args.leadId };
  await enqueue(db, { type: "email", payload, runAt: args.runAt, dedupeKey: `${args.key}:email`, ...links });
  if (args.sms) {
    await enqueue(db, {
      type: "sms",
      payload,
      runAt: args.smsRunAt ?? args.runAt,
      dedupeKey: `${args.key}:sms`,
      ...links,
    });
  }
}

async function customerOf(db: Queryable, booking: Booking) {
  if (!booking.customerId) return null;
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, booking.customerId));
  return c ?? null;
}

export async function enqueueBookingConfirmed(db: Queryable, booking: Booking, settings: OperationalSettings, now: Date) {
  const customer = await customerOf(db, booking);
  const sms = canTextCustomer(customer);
  await both(db, { template: "booking_confirmed", audience: "customer", key: `booking:${booking.id}:confirmed`, runAt: now, bookingId: booking.id, sms });
  await both(db, { template: "owner_booking_confirmed", audience: "owner", key: `booking:${booking.id}:owner_confirmed`, runAt: now, bookingId: booking.id, sms: true });
  await enqueueReminders(db, booking, settings, now, sms);
  if (business.flags.googleCalendarSync) {
    await enqueue(db, {
      type: "gcal.upsert",
      payload: { bookingId: booking.id },
      runAt: now,
      dedupeKey: `booking:${booking.id}:gcal:${booking.startsAt.toISOString()}`,
      bookingId: booking.id,
    });
  }
}

export async function enqueueReminders(
  db: Queryable,
  booking: Booking,
  settings: OperationalSettings,
  now: Date,
  sms?: boolean,
) {
  const canSms = sms ?? canTextCustomer(await customerOf(db, booking));
  const plans = planReminders({
    startsAt: booking.startsAt.getTime(),
    now: now.getTime(),
    hoursBefore: settings.reminders.hoursBefore,
    tz: booking.timezone,
    quietStart: settings.reminders.smsQuietStart,
    quietEnd: settings.reminders.smsQuietEnd,
  });
  for (const p of plans) {
    await both(db, {
      template: "booking_reminder",
      audience: "customer",
      // starts_at in the key: rescheduling produces new reminders, never duplicates.
      key: `booking:${booking.id}:reminder:${p.hoursBefore}h:${booking.startsAt.toISOString()}`,
      runAt: new Date(p.emailAt),
      bookingId: booking.id,
      sms: canSms && p.smsAt !== null,
      smsRunAt: p.smsAt !== null ? new Date(p.smsAt) : null,
      data: { hoursBefore: p.hoursBefore },
    });
  }
}

export async function cancelReminders(db: Queryable, bookingId: string) {
  await cancelPending(db, bookingId, `booking:${bookingId}:reminder:`);
}

export async function enqueueBookingCancelled(db: Queryable, booking: Booking, now: Date) {
  const customer = await customerOf(db, booking);
  await cancelReminders(db, booking.id);
  await both(db, { template: "booking_cancelled", audience: "customer", key: `booking:${booking.id}:cancelled`, runAt: now, bookingId: booking.id, sms: canTextCustomer(customer) });
  await both(db, { template: "owner_booking_cancelled", audience: "owner", key: `booking:${booking.id}:owner_cancelled`, runAt: now, bookingId: booking.id, sms: true });
  if (business.flags.googleCalendarSync) {
    await enqueue(db, { type: "gcal.delete", payload: { bookingId: booking.id }, runAt: now, dedupeKey: `booking:${booking.id}:gcal:delete`, bookingId: booking.id });
  }
}

export async function enqueueBookingRescheduled(
  db: Queryable,
  booking: Booking,
  previousStart: Date,
  settings: OperationalSettings,
  now: Date,
) {
  const customer = await customerOf(db, booking);
  const sms = canTextCustomer(customer);
  const key = `booking:${booking.id}:rescheduled:${booking.startsAt.toISOString()}`;
  await cancelReminders(db, booking.id);
  await both(db, { template: "booking_rescheduled", audience: "customer", key, runAt: now, bookingId: booking.id, sms, data: { previousStart: previousStart.toISOString() } });
  await both(db, { template: "owner_booking_rescheduled", audience: "owner", key: `${key}:owner`, runAt: now, bookingId: booking.id, sms: true, data: { previousStart: previousStart.toISOString() } });
  await enqueueReminders(db, booking, settings, now, sms);
  if (business.flags.googleCalendarSync) {
    await enqueue(db, { type: "gcal.upsert", payload: { bookingId: booking.id }, runAt: now, dedupeKey: `booking:${booking.id}:gcal:${booking.startsAt.toISOString()}`, bookingId: booking.id });
  }
}

export async function enqueueReviewRequest(db: Queryable, booking: Booking, settings: OperationalSettings, now: Date) {
  const customer = await customerOf(db, booking);
  const runAt = new Date(now.getTime() + settings.reminders.reviewDelayHours * HOUR);
  await both(db, { template: "review_request", audience: "customer", key: `booking:${booking.id}:review`, runAt, bookingId: booking.id, sms: canTextCustomer(customer) });
}

export async function enqueueLatePaymentRefunded(db: Queryable, booking: Booking, now: Date) {
  const customer = await customerOf(db, booking);
  await both(db, { template: "late_payment_refunded", audience: "customer", key: `booking:${booking.id}:late_refund`, runAt: now, bookingId: booking.id, sms: canTextCustomer(customer) });
  await ownerAlert(db, {
    key: `booking:${booking.id}:late_refund_alert`,
    now,
    bookingId: booking.id,
    subject: `Late payment refunded — ${booking.number}`,
    body: `A deposit for ${booking.number} arrived after the hold expired and the time was no longer free. It has been refunded automatically and the customer was told. Consider reaching out to rebook.`,
  });
}

export async function ownerAlert(
  db: Queryable,
  args: { key: string; now: Date; subject: string; body: string; bookingId?: string; sms?: boolean },
) {
  await both(db, {
    template: "owner_alert",
    audience: "owner",
    key: args.key,
    runAt: args.now,
    bookingId: args.bookingId,
    sms: args.sms ?? false,
    data: { subject: args.subject, body: args.body },
  });
}

export async function enqueueQuoteReceived(db: Queryable, quote: typeof s.quoteRequests.$inferSelect, now: Date) {
  await both(db, { template: "quote_received", audience: "customer", key: `quote:${quote.id}:received`, runAt: now, quoteRequestId: quote.id, sms: false });
  await both(db, { template: "owner_new_quote", audience: "owner", key: `quote:${quote.id}:owner_new`, runAt: now, quoteRequestId: quote.id, sms: true });
}

export async function enqueueQuoteSent(db: Queryable, quote: typeof s.quoteRequests.$inferSelect, sms: boolean, now: Date) {
  await both(db, {
    template: "quote_sent",
    audience: "customer",
    key: `quote:${quote.id}:sent:v${quote.quoteTokenVersion}`,
    runAt: now,
    quoteRequestId: quote.id,
    sms,
  });
}

export async function enqueueLeadReceived(db: Queryable, lead: typeof s.leads.$inferSelect, now: Date) {
  await both(db, { template: "owner_new_lead", audience: "owner", key: `lead:${lead.id}:owner`, runAt: now, leadId: lead.id, sms: true });
  if (lead.email) {
    await enqueue(db, {
      type: "email",
      payload: { template: "contact_received", audience: "customer", leadId: lead.id, data: {} },
      runAt: now,
      dedupeKey: `lead:${lead.id}:ack:email`,
      leadId: lead.id,
    });
  }
}
