/**
 * Integration tests on a real Postgres (embedded): holds, the exclusion constraint under
 * true concurrency, payments/webhooks, late payment, reschedule, cancel, outbox.
 */
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { pgErrorCode } from "@/db/client";
import * as s from "@/db/schema";
import { now } from "@/lib/server/clock";
import { attachContact, handlePaymentEvent, startPayment } from "@/lib/server/booking/checkout";
import { createHold, findBookingByToken, sweepExpiredHolds, type HoldRequest } from "@/lib/server/booking/holds";
import { cancelBooking, rescheduleBooking } from "@/lib/server/booking/manage";
import { flushOutbox } from "@/lib/server/jobs";
import { db, at, attribution, ids, mobileLocation, resetDb, shopLocation } from "../support/db";

const clock = () => new Date(now());
const SLOT = "2026-11-03T15:00:00.000Z"; // Tue 9:00 CST
const contact = { name: "Alex Driver", phone: "+12015550131", email: "alex@example.com", preferredContact: "email" as const, smsConsent: true, leadConsent: true };

async function holdReq(p: Partial<HoldRequest> = {}): Promise<HoldRequest> {
  const { pkg } = await ids();
  return {
    idempotencyKey: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    selection: { sizeId: "sedan", packageId: pkg("gold"), serviceIds: [], addonIds: [], conditionIds: [] },
    vehicle: {},
    location: mobileLocation(),
    slotStart: SLOT,
    attribution,
    ...p,
  };
}

async function confirmViaWebhook(token: string, eventId = crypto.randomUUID()) {
  const r = await startPayment(token, { expectedTotalCents: (await findBookingByToken(db(), token))!.totalCents, sessionId: crypto.randomUUID() }, clock());
  if (!r.ok || r.kind !== "payment") throw new Error(`startPayment: ${JSON.stringify(r)}`);
  const [p] = await db().select().from(s.payments).where(eq(s.payments.stripeCheckoutSessionId, r.sessionId));
  const event = {
    id: eventId,
    kind: "deposit_paid" as const,
    rawType: "checkout.session.completed",
    sessionId: r.sessionId,
    paymentIntentId: `pi_${p!.id}`,
    amountCents: p!.amountCents,
    currency: "usd",
  };
  return { event, session: r };
}

describe("booking flow (integration)", () => {
  beforeEach(async () => {
    await resetDb();
    at("2026-10-22T15:00:00Z");
  });

  it("I-HOLD-01 hold → contact → pay → webhook → confirmed, notifications queued (scenario 1)", async () => {
    const hold = await createHold(await holdReq(), clock());
    expect(hold.ok).toBe(true);
    if (!hold.ok) return;
    expect((await attachContact(hold.token, contact, { ip: "1.2.3.4", now: clock(), sessionId: crypto.randomUUID() })).ok).toBe(true);
    const { event } = await confirmViaWebhook(hold.token);
    expect((await handlePaymentEvent(event, clock())).status).toBe("processed");
    const b = await findBookingByToken(db(), hold.token);
    expect(b?.status).toBe("confirmed");
    const outbox = await db().select().from(s.outbox).where(eq(s.outbox.bookingId, b!.id));
    const keys = outbox.map((o) => o.dedupeKey);
    expect(keys.some((k) => k.endsWith(":confirmed:email"))).toBe(true);
    expect(keys.some((k) => k.endsWith(":confirmed:sms"))).toBe(true);
    expect(keys.some((k) => k.includes(":owner_confirmed:"))).toBe(true);
    expect(keys.filter((k) => k.includes(":reminder:24h:")).length).toBeGreaterThan(0);
    expect(keys.filter((k) => k.includes(":reminder:2h:")).length).toBeGreaterThan(0);
    await flushOutbox(db(), { limit: 100 });
    const sent = await db().select().from(s.outbox).where(and(eq(s.outbox.bookingId, b!.id), eq(s.outbox.status, "done")));
    expect(sent.length).toBeGreaterThanOrEqual(4);
  });

  it("I-DB-EXCL-01 two simultaneous holds on one crew: exactly one wins (scenario 6)", async () => {
    // Only one mobile crew for this test. Reseeding issues new ids, so look it up each round.
    for (let round = 0; round < 20; round++) {
      await resetDb();
      const crews = (await ids()).resources.filter((r) => r.type === "mobile_crew");
      expect(crews.length).toBeGreaterThanOrEqual(2);
      await db().update(s.resources).set({ active: false }).where(eq(s.resources.id, crews[1]!.id));
      const reqs = await Promise.all([holdReq(), holdReq(), holdReq()]);
      const results = await Promise.all(reqs.map((r) => createHold(r, clock())));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const losers = results.filter((r) => !r.ok);
      expect(losers.every((r) => !r.ok && r.code === "SLOT_TAKEN")).toBe(true);
      expect(losers.every((r) => !r.ok && "alternatives" in r && r.alternatives.length > 0)).toBe(true);
    }
  });

  it("I-DB-EXCL-02 two crews: two customers can take the same time, the third can't", async () => {
    const results = await Promise.all((await Promise.all([holdReq(), holdReq(), holdReq()])).map((r) => createHold(r, clock())));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
  });

  it("I-DB-EXCL-03 the database itself rejects overlapping active allocations", async () => {
    const { resources } = await ids();
    const r = resources[0]!.id;
    await db().insert(s.resourceAllocations).values({ resourceId: r, kind: "block", period: { start: new Date("2026-11-04T15:00:00Z"), end: new Date("2026-11-04T17:00:00Z") } });
    await expect(
      db().insert(s.resourceAllocations).values({ resourceId: r, kind: "block", period: { start: new Date("2026-11-04T16:00:00Z"), end: new Date("2026-11-04T18:00:00Z") } }),
    ).rejects.toSatisfy((e: unknown) => pgErrorCode(e) === "23P01");
  });

  it("I-HOLD-02 idempotent retry returns the same hold", async () => {
    const req = await holdReq();
    const a = await createHold(req, clock());
    const b = await createHold(req, clock());
    expect(a.ok && b.ok && a.bookingId === b.bookingId).toBe(true);
  });

  it("I-HOLD-EXPIRE hold expires → slot free again, booking expired, abandoned lead created (scenario 7)", async () => {
    const hold = await createHold(await holdReq(), clock());
    if (!hold.ok) throw new Error("hold failed");
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    const later = at("2026-10-22T15:20:00Z");
    // Another customer takes the slot after expiry: the sweep inside createHold frees it.
    const crews = (await ids()).resources.filter((r) => r.type === "mobile_crew");
    await db().update(s.resources).set({ active: false }).where(eq(s.resources.id, crews[1]!.id));
    const second = await createHold(await holdReq(), later);
    expect(second.ok).toBe(true);
    const first = await findBookingByToken(db(), hold.token);
    expect(first?.status).toBe("expired");
    const [lead] = await db().select().from(s.leads).where(eq(s.leads.bookingId, first!.id));
    expect(lead?.source).toBe("booking_abandoned");
  });

  it("I-WEBHOOK-01 webhook delivered twice → one confirmation, one payment (scenario 9)", async () => {
    const hold = await createHold(await holdReq(), clock());
    if (!hold.ok) throw new Error();
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    const { event } = await confirmViaWebhook(hold.token, "evt_dupe");
    const first = await handlePaymentEvent(event, clock());
    const second = await handlePaymentEvent(event, clock());
    expect(first.status).toBe("processed");
    expect(second.status).toBe("duplicate");
    const distinctEvent = await handlePaymentEvent({ ...event, id: "evt_other" }, clock());
    expect(distinctEvent).toMatchObject({ outcome: "already_succeeded" });
    const b = await findBookingByToken(db(), hold.token);
    const [{ n }] = (await db().execute<{ n: number }>(sql`select count(*)::int as n from booking_events where booking_id = ${b!.id} and type = 'payment_succeeded'`)).rows as [{ n: number }];
    expect(n).toBe(1);
  });

  it("I-WEBHOOK-02 amount mismatch never confirms", async () => {
    const hold = await createHold(await holdReq(), clock());
    if (!hold.ok) throw new Error();
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    const { event } = await confirmViaWebhook(hold.token);
    const r = await handlePaymentEvent({ ...event, amountCents: 1 }, clock());
    expect(r).toMatchObject({ outcome: "amount_mismatch" });
    expect((await findBookingByToken(db(), hold.token))?.status).toBe("pending_payment");
  });

  it("I-LATE-PAY payment after the hold lapsed: re-acquired if free, refunded if taken (scenario 8)", async () => {
    const hold = await createHold(await holdReq(), clock());
    if (!hold.ok) throw new Error();
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    const { event } = await confirmViaWebhook(hold.token);
    const later = at("2026-10-22T16:00:00Z");
    await db().transaction((tx) => sweepExpiredHolds(tx, later));
    expect((await findBookingByToken(db(), hold.token))?.status).toBe("expired");
    const r = await handlePaymentEvent(event, later);
    expect(r).toMatchObject({ outcome: "late_confirmed" });
    expect((await findBookingByToken(db(), hold.token))?.status).toBe("confirmed");
  });

  it("I-LATE-PAY-02 slot taken meanwhile → automatic refund queued", async () => {
    const crews = (await ids()).resources.filter((r) => r.type === "mobile_crew");
    await db().update(s.resources).set({ active: false }).where(eq(s.resources.id, crews[1]!.id));
    const hold = await createHold(await holdReq(), clock());
    if (!hold.ok) throw new Error();
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    const { event } = await confirmViaWebhook(hold.token);
    const later = at("2026-10-22T16:00:00Z");
    const thief = await createHold(await holdReq(), later);
    expect(thief.ok).toBe(true);
    const r = await handlePaymentEvent(event, later);
    expect(r).toMatchObject({ outcome: "late_refunded" });
    const b = await findBookingByToken(db(), hold.token);
    const refunds = await db().select().from(s.outbox).where(and(eq(s.outbox.bookingId, b!.id), eq(s.outbox.type, "stripe.refund")));
    expect(refunds).toHaveLength(1);
  });

  it("I-NO-DEPOSIT deposit disabled → confirmed without payment (scenario 16)", async () => {
    const [row] = await db().select().from(s.settings);
    await db().update(s.settings).set({ data: { ...row!.data, deposit: { mode: "none" } } });
    const hold = await createHold(await holdReq({ location: shopLocation }), clock());
    if (!hold.ok) throw new Error(JSON.stringify(hold));
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    const r = await startPayment(hold.token, { expectedTotalCents: hold.price.totalCents, sessionId: crypto.randomUUID() }, clock());
    expect(r).toMatchObject({ ok: true, kind: "confirmed" });
    expect((await findBookingByToken(db(), hold.token))?.status).toBe("confirmed");
  });

  it("I-PRICE-TAMPER the client's expected total must match the server's price", async () => {
    const hold = await createHold(await holdReq(), clock());
    if (!hold.ok) throw new Error();
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    const r = await startPayment(hold.token, { expectedTotalCents: 1, sessionId: crypto.randomUUID() }, clock());
    expect(r).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
  });

  it("I-OUT-OF-AREA ZIP outside every zone is rejected (scenario 4)", async () => {
    const r = await createHold(await holdReq({ location: mobileLocation("99999") }), clock());
    expect(r).toMatchObject({ ok: false, code: "OUT_OF_AREA" });
  });

  it("I-RESCHEDULE old slot freed, new slot held, reminders re-keyed (scenario 11)", async () => {
    const hold = await createHold(await holdReq(), clock());
    if (!hold.ok) throw new Error();
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    await handlePaymentEvent((await confirmViaWebhook(hold.token)).event, clock());
    const before = (await findBookingByToken(db(), hold.token))!;
    const r = await rescheduleBooking(before, "2026-11-05T16:00:00.000Z", { kind: "customer" }, clock());
    expect(r.ok).toBe(true);
    const after = (await findBookingByToken(db(), hold.token))!;
    expect(after.startsAt.toISOString()).toBe("2026-11-05T16:00:00.000Z");
    expect(after.rescheduleCount).toBe(1);
    // The old slot is bookable again.
    const other = await createHold(await holdReq(), clock());
    expect(other.ok).toBe(true);
    const pending = await db().select().from(s.outbox).where(and(eq(s.outbox.bookingId, after.id), eq(s.outbox.status, "pending")));
    expect(pending.some((o) => o.dedupeKey.includes("2026-11-05T16:00:00.000Z"))).toBe(true);
    expect(pending.some((o) => o.dedupeKey.includes(`reminder:24h:${SLOT}`))).toBe(false);
  });

  it("I-CANCEL inside and outside the window (scenario 12)", async () => {
    const book = async () => {
      const hold = await createHold(await holdReq(), clock());
      if (!hold.ok) throw new Error();
      await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
      await handlePaymentEvent((await confirmViaWebhook(hold.token)).event, clock());
      return (await findBookingByToken(db(), hold.token))!;
    };
    const early = await book();
    const out = await cancelBooking(early, { actor: "customer" }, clock());
    expect(out).toMatchObject({ ok: true, late: false, refundCents: 5000 });

    const late = await book();
    const lateNow = at("2026-11-03T13:00:00Z"); // 2 hours before
    const inside = await cancelBooking(late, { actor: "customer" }, lateNow);
    expect(inside).toMatchObject({ ok: true, late: true, refundCents: 0, feeCents: 5000 });
  });
});
