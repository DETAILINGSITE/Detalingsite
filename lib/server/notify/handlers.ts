/**
 * Outbox handlers: resolve recipients/content at send time and deliver.
 */
import { eq, inArray } from "drizzle-orm";
import { createElement } from "react";
import { render } from "react-email";
import { business } from "@/config/business";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { BrandedEmail } from "@/emails/branded-email";
import { env, siteUrl } from "@/lib/env";
import { manageTokenFor } from "../booking/holds";
import { paymentDriver } from "../payments";
import type { HandlerResult, OutboxHandler, OutboxRow, OutboxType } from "../outbox";
import { deriveToken } from "../tokens";
import { sendEmail, sendSms } from "./channels";
import { canTextCustomer, type Audience, type EmailTemplate } from "./enqueue";
import { buildMessage, type MessageInput } from "./messages";
import { syncCalendar } from "./calendar";

interface NotifyPayload {
  template: EmailTemplate;
  audience: Audience;
  bookingId?: string | null;
  quoteRequestId?: string | null;
  leadId?: string | null;
  data?: Record<string, unknown>;
}

const BOOKING_LIVE_TEMPLATES: EmailTemplate[] = ["booking_reminder", "review_request"];

async function loadInput(db: Db, p: NotifyPayload): Promise<MessageInput> {
  const base = siteUrl();
  const input: MessageInput = { template: p.template, audience: p.audience, siteUrl: base, data: p.data };
  if (p.bookingId) {
    const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, p.bookingId));
    input.booking = b ?? null;
    if (b) {
      input.manageUrl = `${base}/booking/${manageTokenFor(b.id, b.manageTokenVersion)}`;
      const ids = b.priceSnapshot.resolvedServiceIds ?? [];
      const svc = ids.length ? await db.select().from(s.services).where(inArray(s.services.id, ids)) : [];
      const lineNames = b.priceSnapshot.lines
        .filter((l) => l.kind === "package" || l.kind === "service" || l.kind === "addon" || l.kind === "quote")
        .map((l) => l.label);
      input.serviceNames = lineNames;
      input.whatToExpect = [...new Set(svc.flatMap((x) => x.whatToExpect))].slice(0, 6);
      if (b.customerId) {
        const [c] = await db.select().from(s.customers).where(eq(s.customers.id, b.customerId));
        input.customer = c ?? null;
      }
    }
  }
  if (p.quoteRequestId) {
    const [q] = await db.select().from(s.quoteRequests).where(eq(s.quoteRequests.id, p.quoteRequestId));
    input.quote = q ?? null;
    if (q) {
      if (q.quoteTokenVersion > 0)
        input.quoteUrl = `${base}/quote/${deriveToken(env().TOKEN_PEPPER, "quote", q.id, q.quoteTokenVersion)}`;
      if (!input.customer) {
        const [c] = await db.select().from(s.customers).where(eq(s.customers.id, q.customerId));
        input.customer = c ?? null;
      }
    }
  }
  if (p.leadId) {
    const [l] = await db.select().from(s.leads).where(eq(s.leads.id, p.leadId));
    input.lead = l ?? null;
  }
  return input;
}

function skip(reason: string): HandlerResult {
  return { status: "skipped", payloadPatch: { skipReason: reason } };
}

const emailHandler: OutboxHandler = async (row: OutboxRow, db: Db) => {
  const p = row.payload as unknown as NotifyPayload;
  const input = await loadInput(db, p);
  if (BOOKING_LIVE_TEMPLATES.includes(p.template) && input.booking) {
    const ok = p.template === "review_request" ? input.booking.status === "completed" : input.booking.status === "confirmed";
    if (!ok) return skip(`booking is ${input.booking.status}`);
  }
  const to =
    p.audience === "owner"
      ? (env().OWNER_NOTIFY_EMAIL ?? business.contact.email)
      : (input.customer?.email ?? input.lead?.email ?? null);
  if (!to) return skip("no recipient email");
  const message = buildMessage(input);
  const element = createElement(BrandedEmail, { message, siteUrl: input.siteUrl });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const res = await sendEmail({
    to,
    subject: message.subject,
    html,
    text,
    replyTo: p.audience === "customer" ? business.contact.email : undefined,
  });
  const rendered = { to, subject: message.subject, text: text.slice(0, 4000) };
  if (res.status === "skipped") return { status: "skipped", payloadPatch: { skipReason: res.reason, rendered } };
  return { status: "done", providerId: res.providerId, payloadPatch: { rendered } };
};

const smsHandler: OutboxHandler = async (row: OutboxRow, db: Db) => {
  const p = row.payload as unknown as NotifyPayload;
  const input = await loadInput(db, p);
  if (BOOKING_LIVE_TEMPLATES.includes(p.template) && input.booking) {
    const ok = p.template === "review_request" ? input.booking.status === "completed" : input.booking.status === "confirmed";
    if (!ok) return skip(`booking is ${input.booking.status}`);
  }
  let to: string | null;
  if (p.audience === "owner") to = env().OWNER_NOTIFY_PHONE ?? null;
  else to = canTextCustomer(input.customer) ? (input.customer?.phoneE164 ?? null) : null;
  if (!to) return skip(p.audience === "owner" ? "OWNER_NOTIFY_PHONE not set" : "no SMS consent");
  const message = buildMessage(input);
  if (!message.sms) return skip("template has no SMS");
  const res = await sendSms({ to, body: message.sms });
  const rendered = { to, body: message.sms };
  if (res.status === "skipped") return { status: "skipped", payloadPatch: { skipReason: res.reason, rendered } };
  return { status: "done", providerId: res.providerId, payloadPatch: { rendered } };
};

const expireSessionHandler: OutboxHandler = async (row) => {
  const driver = paymentDriver();
  if (!driver) return skip("payments not configured");
  await driver.expireSession(String(row.payload.sessionId));
  return { status: "done" };
};

const refundHandler: OutboxHandler = async (row, db) => {
  const driver = paymentDriver();
  if (!driver) return skip("payments not configured");
  const p = row.payload as { bookingId: string; paymentId: string; paymentIntentId: string | null; amountCents: number; reason: string };
  let pi = p.paymentIntentId;
  if (!pi) {
    const [payment] = await db.select().from(s.payments).where(eq(s.payments.id, p.paymentId));
    pi = payment?.stripePaymentIntentId ?? null;
  }
  if (!pi) throw new Error("payment intent not known yet");
  const refund = await driver.refund({
    paymentIntentId: pi,
    amountCents: p.amountCents,
    idempotencyKey: row.dedupeKey,
    metadata: { bookingId: p.bookingId, reason: p.reason },
  });
  await db
    .insert(s.payments)
    .values({
      bookingId: p.bookingId,
      kind: "refund",
      method: "stripe",
      amountCents: p.amountCents,
      status: refund.status === "succeeded" ? "refunded" : "open",
      stripeRefundId: refund.refundId,
      idempotencyKey: `refund-row:${row.dedupeKey}`,
      note: p.reason,
    })
    .onConflictDoNothing();
  return { status: "done", providerId: refund.refundId };
};

const gcalUpsert: OutboxHandler = async (row, db) => syncCalendar(db, String(row.payload.bookingId), "upsert");
const gcalDelete: OutboxHandler = async (row, db) => syncCalendar(db, String(row.payload.bookingId), "delete");

export const outboxHandlers: Partial<Record<OutboxType, OutboxHandler>> = {
  email: emailHandler,
  sms: smsHandler,
  "stripe.expire_session": expireSessionHandler,
  "stripe.refund": refundHandler,
  "gcal.upsert": gcalUpsert,
  "gcal.delete": gcalDelete,
};
