import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES, BOOKING_TRANSITIONS, canTransition, canTransitionQuote, QUOTE_STATUSES, QUOTE_TRANSITIONS } from "@/lib/domain/booking-state";
import { canReschedule, cancellationOutcome } from "@/lib/domain/policy";

const H = 3_600_000;
const start = Date.parse("2026-11-10T15:00:00Z");
const base = { startsAt: start, depositPaidCents: 5000, totalCents: 30000, actor: "customer" as const };

describe("U-POLICY cancellation & reschedule", () => {
  it("U-POLICY-01 outside the window → full refund (scenario 12)", () => {
    const o = cancellationOutcome({ ...base, now: start - 48 * H, policy: { windowHours: 24, lateFee: { type: "forfeit_deposit" } } });
    expect(o).toEqual({ late: false, feeCents: 0, refundCents: 5000, feeOwedCents: 0 });
  });
  it("U-POLICY-02 exactly at the boundary counts as outside", () => {
    expect(cancellationOutcome({ ...base, now: start - 24 * H, policy: { windowHours: 24, lateFee: { type: "forfeit_deposit" } } }).late).toBe(false);
  });
  it("U-POLICY-03 inside the window: forfeit / fixed / percent", () => {
    const now = start - 2 * H;
    expect(cancellationOutcome({ ...base, now, policy: { windowHours: 24, lateFee: { type: "forfeit_deposit" } } })).toEqual({ late: true, feeCents: 5000, refundCents: 0, feeOwedCents: 0 });
    expect(cancellationOutcome({ ...base, now, policy: { windowHours: 24, lateFee: { type: "fixed", cents: 2000 } } })).toEqual({ late: true, feeCents: 2000, refundCents: 3000, feeOwedCents: 0 });
    expect(cancellationOutcome({ ...base, now, policy: { windowHours: 24, lateFee: { type: "percent", percent: 25 } } })).toEqual({ late: true, feeCents: 5000, refundCents: 0, feeOwedCents: 2500 });
  });
  it("U-POLICY-04 no deposit paid: late fee recorded as owed, nothing refunded", () => {
    const o = cancellationOutcome({ ...base, depositPaidCents: 0, now: start - H, policy: { windowHours: 24, lateFee: { type: "fixed", cents: 2000 } } });
    expect(o).toEqual({ late: true, feeCents: 0, refundCents: 0, feeOwedCents: 2000 });
  });
  it("U-POLICY-05 admin cancellations waive the fee by default", () => {
    const o = cancellationOutcome({ ...base, actor: "admin", now: start - H, policy: { windowHours: 24, lateFee: { type: "forfeit_deposit" } } });
    expect(o.refundCents).toBe(5000);
    expect(cancellationOutcome({ ...base, actor: "admin", waiveFee: false, now: start - H, policy: { windowHours: 24, lateFee: { type: "forfeit_deposit" } } }).refundCents).toBe(0);
  });
  it("U-POLICY-07 non-refundable deposit: kept on any customer cancellation, early or late", () => {
    const policy = { windowHours: 24, lateFee: { type: "forfeit_deposit" as const }, depositRefundable: false };
    expect(cancellationOutcome({ ...base, now: start - 10 * 24 * H, policy })).toEqual({ late: false, feeCents: 5000, refundCents: 0, feeOwedCents: 0 });
    expect(cancellationOutcome({ ...base, now: start - H, policy })).toEqual({ late: true, feeCents: 5000, refundCents: 0, feeOwedCents: 0 });
    // A late fee bigger than the deposit is still owed on top.
    expect(cancellationOutcome({ ...base, now: start - H, policy: { ...policy, lateFee: { type: "fixed", cents: 8000 } } })).toEqual({ late: true, feeCents: 5000, refundCents: 0, feeOwedCents: 3000 });
  });
  it("U-POLICY-08 non-refundable deposit: admins keep it by default but can choose to refund", () => {
    const policy = { windowHours: 24, lateFee: { type: "forfeit_deposit" as const }, depositRefundable: false };
    expect(cancellationOutcome({ ...base, actor: "admin", now: start - 48 * H, policy }).refundCents).toBe(0);
    expect(cancellationOutcome({ ...base, actor: "admin", waiveFee: true, now: start - 48 * H, policy }).refundCents).toBe(5000);
  });
  it("U-POLICY-06 reschedule limits", () => {
    const policy = { minHoursBefore: 24, maxCount: 2 };
    expect(canReschedule({ startsAt: start, now: start - 48 * H, count: 0, status: "confirmed", policy, actor: "customer" })).toEqual({ ok: true });
    expect(canReschedule({ startsAt: start, now: start - 2 * H, count: 0, status: "confirmed", policy, actor: "customer" })).toEqual({ ok: false, reason: "too_late" });
    expect(canReschedule({ startsAt: start, now: start - 48 * H, count: 2, status: "confirmed", policy, actor: "customer" })).toEqual({ ok: false, reason: "limit_reached" });
    expect(canReschedule({ startsAt: start, now: start - H, count: 9, status: "confirmed", policy, actor: "admin" })).toEqual({ ok: true });
    expect(canReschedule({ startsAt: start, now: start - 48 * H, count: 0, status: "cancelled", policy, actor: "admin" })).toEqual({ ok: false, reason: "not_confirmed" });
  });
});

describe("U-STATE transition tables", () => {
  it("U-STATE-01 every event allows exactly its 'from' statuses", () => {
    for (const [event, t] of Object.entries(BOOKING_TRANSITIONS)) {
      for (const status of BOOKING_STATUSES) {
        expect(canTransition(status, event as keyof typeof BOOKING_TRANSITIONS), `${event} from ${status}`).toBe((t.from as readonly string[]).includes(status));
      }
    }
  });
  it("U-STATE-02 the booking lifecycle in the brief is reachable", () => {
    expect(canTransition("held", "start_payment")).toBe(true);
    expect(canTransition("pending_payment", "payment_succeeded")).toBe(true);
    expect(canTransition("confirmed", "start")).toBe(true);
    expect(canTransition("in_progress", "complete")).toBe(true);
    expect(canTransition("confirmed", "cancel")).toBe(true);
    expect(canTransition("confirmed", "no_show")).toBe(true);
    expect(canTransition("expired", "late_payment_reacquired")).toBe(true);
  });
  it("U-STATE-03 terminal states cannot be confirmed again (double webhook is a no-op)", () => {
    expect(canTransition("confirmed", "payment_succeeded")).toBe(false);
    expect(canTransition("cancelled", "payment_succeeded")).toBe(false);
    expect(canTransition("completed", "cancel")).toBe(false);
  });
  it("U-STATE-04 quote transitions", () => {
    for (const [event, t] of Object.entries(QUOTE_TRANSITIONS))
      for (const status of QUOTE_STATUSES)
        expect(canTransitionQuote(status, event as keyof typeof QUOTE_TRANSITIONS)).toBe((t.from as readonly string[]).includes(status));
  });
});
