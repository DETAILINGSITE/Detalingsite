import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { now } from "@/lib/server/clock";
import { attachContact, handlePaymentEvent, startPayment } from "@/lib/server/booking/checkout";
import { createHold, findBookingByToken } from "@/lib/server/booking/holds";
import { getAvailability } from "@/lib/server/booking/availability-service";
import { createLead } from "@/lib/server/leads";
import { sendQuote, submitQuoteRequest } from "@/lib/server/quotes";
import { rateLimit } from "@/lib/server/rate-limit";
import { db, at, attribution, mobileLocation, resetDb } from "../support/db";

const clock = () => new Date(now());
const contact = { name: "Quinn Quote", phone: "+12015550132", email: "quinn@example.com", preferredContact: "sms" as const, smsConsent: false, leadConsent: false };

describe("quotes, leads, availability (integration)", () => {
  beforeEach(async () => {
    await resetDb();
    at("2026-10-22T15:00:00Z");
  });

  it("I-QUOTE-01 request → priced → link → booked → accepted (scenario 5)", async () => {
    const submitted = await submitQuoteRequest(
      {
        submissionId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        uploadSessionId: crypto.randomUUID(),
        vehicle: { sizeId: "suv", make: "Boat", model: "Trailer" },
        job: { description: "Full gelcoat oxidation removal on a 22ft boat, please.", photoIds: [], preferredDates: ["2026-11-10"], serviceIds: [] },
        location: mobileLocation(),
        contact,
        attribution,
      },
      { ip: null, now: clock() },
    );
    expect(submitted.ok).toBe(true);
    const [q] = await db().select().from(s.quoteRequests);
    expect(q?.status).toBe("new");
    const [lead] = await db().select().from(s.leads).where(eq(s.leads.quoteRequestId, q!.id));
    expect(lead?.source).toBe("quote");
    const owner = await db().select().from(s.outbox).where(eq(s.outbox.quoteRequestId, q!.id));
    expect(owner.some((o) => o.dedupeKey.includes("owner_new"))).toBe(true);

    const sent = await sendQuote(q!.id, { priceCents: 120000, durationMin: 360, depositCents: 20000, message: "Thanks!", validDays: 14, adminId: "admin" }, clock());
    expect(sent.ok).toBe(true);
    const token = sent.ok ? sent.token : "";

    const avail = await getAvailability({ selection: { sizeId: "suv", packageId: null, serviceIds: [], addonIds: [], conditionIds: [] }, locationType: "mobile", quoteToken: token }, clock());
    expect(avail.ok && avail.durationMin === 360).toBe(true);
    const slot = avail.ok ? avail.days[0]!.slots[0]!.start : "";

    const hold = await createHold(
      { idempotencyKey: crypto.randomUUID(), sessionId: crypto.randomUUID(), selection: { sizeId: "suv", packageId: null, serviceIds: [], addonIds: [], conditionIds: [] }, vehicle: {}, location: { locationType: "shop" }, slotStart: slot, quoteToken: token, attribution },
      clock(),
    );
    expect(hold.ok).toBe(true);
    if (!hold.ok) return;
    expect(hold.price.totalCents).toBe(120000);
    expect(hold.price.depositCents).toBe(20000);
    await attachContact(hold.token, contact, { ip: null, now: clock(), sessionId: crypto.randomUUID() });
    const pay = await startPayment(hold.token, { expectedTotalCents: 120000, sessionId: crypto.randomUUID() }, clock());
    if (!pay.ok || pay.kind !== "payment") throw new Error(JSON.stringify(pay));
    const [p] = await db().select().from(s.payments).where(eq(s.payments.stripeCheckoutSessionId, pay.sessionId));
    await handlePaymentEvent({ id: "evt_q", kind: "deposit_paid", rawType: "checkout.session.completed", sessionId: pay.sessionId, paymentIntentId: "pi_q", amountCents: p!.amountCents, currency: "usd" }, clock());
    const b = await findBookingByToken(db(), hold.token);
    expect(b?.status).toBe("confirmed");
    const [after] = await db().select().from(s.quoteRequests).where(eq(s.quoteRequests.id, q!.id));
    expect(after?.status).toBe("accepted");
    expect(after?.bookingId).toBe(b!.id);
  });

  it("I-QUOTE-02 revising a quote invalidates the old link", async () => {
    await submitQuoteRequest(
      { submissionId: crypto.randomUUID(), sessionId: crypto.randomUUID(), uploadSessionId: crypto.randomUUID(), vehicle: {}, job: { description: "Fleet of six vans needs monthly washes.", photoIds: [], preferredDates: [], serviceIds: [] }, location: { locationType: "shop" }, contact, attribution },
      { ip: null, now: clock() },
    );
    const [q] = await db().select().from(s.quoteRequests);
    const first = await sendQuote(q!.id, { priceCents: 50000, durationMin: 240, depositCents: null, message: "", validDays: 7, adminId: "a" }, clock());
    const second = await sendQuote(q!.id, { priceCents: 45000, durationMin: 240, depositCents: null, message: "", validDays: 7, adminId: "a" }, clock());
    expect(first.ok && second.ok && first.token !== second.token).toBe(true);
    const old = await getAvailability({ selection: { sizeId: "sedan", packageId: null, serviceIds: [], addonIds: [], conditionIds: [] }, locationType: "shop", quoteToken: first.ok ? first.token : "" }, clock());
    expect(old).toMatchObject({ ok: false, code: "QUOTE_INVALID" });
  });

  it("I-LEAD contact form creates a lead and notifies the owner; submission is idempotent", async () => {
    const id = crypto.randomUUID();
    await createLead({ submissionId: id, source: "contact_form", name: "Lee", email: "lee@example.com", message: "Do you do fleets?", attribution: { utmSource: "google" } }, clock());
    await createLead({ submissionId: id, source: "contact_form", name: "Lee", email: "lee@example.com", message: "Do you do fleets?", attribution: { utmSource: "google" } }, clock());
    const leads = await db().select().from(s.leads);
    expect(leads).toHaveLength(1);
    expect(leads[0]!.attribution.utmSource).toBe("google");
    const owner = await db().select().from(s.outbox).where(eq(s.outbox.leadId, leads[0]!.id));
    expect(owner.some((o) => o.dedupeKey.includes(":owner:"))).toBe(true);
  });

  it("I-RATE fixed-window rate limit", async () => {
    let last = { ok: true };
    for (let i = 0; i < 6; i++) last = await rateLimit(db(), "form", "9.9.9.9", now());
    expect(last.ok).toBe(false);
  });

  it("I-AVAIL blackout and closed days have no slots (scenario 13)", async () => {
    await db().insert(s.blackoutDates).values({ date: "2026-11-04", reason: "Test" });
    const r = await getAvailability({ selection: { sizeId: "sedan", packageId: null, serviceIds: [(await db().select().from(s.services).where(eq(s.services.slug, "exterior-wash-wax")))[0]!.id], addonIds: [], conditionIds: [] }, locationType: "shop", fromDate: "2026-11-02", days: 7 }, clock());
    if (!r.ok) throw new Error(JSON.stringify(r));
    const dates = r.days.map((d) => d.date);
    expect(dates).not.toContain("2026-11-04"); // blackout
    expect(dates).not.toContain("2026-11-08"); // Sunday closed
    expect(dates).toContain("2026-11-03");
  });
});
