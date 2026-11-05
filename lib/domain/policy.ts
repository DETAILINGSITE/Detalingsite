/**
 * Cancellation and reschedule policy (docs/PLAN.md §5.4).
 *
 * "Outside the window" = cancelling at least `windowHours` before the start
 * (exactly at the boundary counts as outside) → full deposit refund.
 * "Inside the window" (late) → fee per `lateFee`, taken from the deposit paid.
 * If no deposit was paid, a late fee can't be charged — it's recorded as owed.
 * With `depositRefundable: false` the deposit is kept on every customer cancellation.
 */
import { percentOf } from "./money";
import type { OperationalSettings } from "./settings";
import { HOUR } from "./time";

export type Actor = "customer" | "admin" | "system";

export interface CancellationInput {
  startsAt: number;
  now: number;
  depositPaidCents: number;
  totalCents: number;
  /** depositRefundable defaults to true when omitted. */
  policy: Omit<OperationalSettings["cancellation"], "depositRefundable"> & { depositRefundable?: boolean };
  actor: Actor;
  /** Admin only: waive the late fee (default true for admin cancellations). */
  waiveFee?: boolean;
}

export interface CancellationOutcome {
  late: boolean;
  feeCents: number;
  refundCents: number;
  /** Fee that applies but couldn't be taken from a deposit. */
  feeOwedCents: number;
}

export function cancellationOutcome(input: CancellationInput): CancellationOutcome {
  const hoursBefore = (input.startsAt - input.now) / HOUR;
  const late = hoursBefore < input.policy.windowHours;
  const refundable = input.policy.depositRefundable !== false;
  // Admins refund by default only when the deposit is refundable; they can still choose to refund
  // a non-refundable deposit (e.g. when the business cancels).
  const waive = input.actor === "admin" ? (refundable ? input.waiveFee !== false : input.waiveFee === true) : false;

  if (waive) {
    return { late, feeCents: 0, refundCents: input.depositPaidCents, feeOwedCents: 0 };
  }
  if (!refundable) {
    // Non-refundable deposit: kept on any cancellation. A late fee beyond the deposit is still owed.
    const lateFee = !late
      ? 0
      : input.policy.lateFee.type === "fixed"
        ? input.policy.lateFee.cents
        : input.policy.lateFee.type === "percent"
          ? percentOf(input.totalCents, input.policy.lateFee.percent)
          : 0;
    return { late, feeCents: input.depositPaidCents, refundCents: 0, feeOwedCents: Math.max(0, lateFee - input.depositPaidCents) };
  }
  if (!late) {
    return { late, feeCents: 0, refundCents: input.depositPaidCents, feeOwedCents: 0 };
  }

  let fee: number;
  switch (input.policy.lateFee.type) {
    case "forfeit_deposit":
      fee = input.depositPaidCents;
      break;
    case "fixed":
      fee = input.policy.lateFee.cents;
      break;
    case "percent":
      fee = percentOf(input.totalCents, input.policy.lateFee.percent);
      break;
  }
  const taken = Math.min(fee, input.depositPaidCents);
  return {
    late,
    feeCents: taken,
    refundCents: input.depositPaidCents - taken,
    feeOwedCents: input.policy.lateFee.type === "forfeit_deposit" ? 0 : fee - taken,
  };
}

export type RescheduleDenial = "too_late" | "limit_reached" | "not_confirmed";

export function canReschedule(input: {
  startsAt: number;
  now: number;
  count: number;
  status: string;
  policy: OperationalSettings["reschedule"];
  actor: Actor;
}): { ok: true } | { ok: false; reason: RescheduleDenial } {
  if (input.status !== "confirmed") return { ok: false, reason: "not_confirmed" };
  if (input.actor === "admin") return { ok: true };
  if (input.count >= input.policy.maxCount) return { ok: false, reason: "limit_reached" };
  if ((input.startsAt - input.now) / HOUR < input.policy.minHoursBefore)
    return { ok: false, reason: "too_late" };
  return { ok: true };
}
