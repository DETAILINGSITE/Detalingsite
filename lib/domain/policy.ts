/**
 * Cancellation and reschedule policy (docs/PLAN.md §5.4).
 *
 * "Outside the window" = cancelling at least `windowHours` before the start
 * (exactly at the boundary counts as outside) → full deposit refund.
 * "Inside the window" (late) → fee per `lateFee`, taken from the deposit paid.
 * If no deposit was paid, a late fee can't be charged — it's recorded as owed.
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
  policy: OperationalSettings["cancellation"];
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
  const waive = input.actor === "admin" ? input.waiveFee !== false : false;

  if (!late || waive) {
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
