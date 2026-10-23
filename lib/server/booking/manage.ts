/**
 * Post-confirmation operations: reschedule, cancel, and admin status changes
 * (docs/PLAN.md §5.4). Shared by the customer manage link and the admin dashboard.
 */
import { and, eq } from "drizzle-orm";
import { EXCLUSION_VIOLATION, getDb, lockResources, pgErrorCode, retryOnDeadlock, type Db } from "@/db/client";
import * as s from "@/db/schema";
import { blockedRange, freeResourcesAt } from "@/lib/domain/availability";
import { canReschedule, cancellationOutcome, type Actor as PolicyActor } from "@/lib/domain/policy";
import { MINUTE } from "@/lib/domain/time";
import { enqueueBookingCancelled, enqueueBookingRescheduled, enqueueReviewRequest } from "../notify/enqueue";
import { queueRefund } from "./checkout";
import { availabilitySettings, eligibleResourceIds, loadAllocations, loadBookingContext } from "./context";
import { activeAllocation } from "./holds";
import { transition, type Actor } from "./transition";

type Booking = typeof s.bookings.$inferSelect;

export async function depositPaidCents(db: Db, bookingId: string): Promise<{ cents: number; paymentId: string | null; paymentIntentId: string | null }> {
  const [p] = await db
    .select()
    .from(s.payments)
    .where(and(eq(s.payments.bookingId, bookingId), eq(s.payments.kind, "deposit"), eq(s.payments.status, "succeeded")));
  return { cents: p?.amountCents ?? 0, paymentId: p?.id ?? null, paymentIntentId: p?.stripePaymentIntentId ?? null };
}

export type RescheduleResult =
  | { ok: true; startsAt: string }
  | { ok: false; code: "NOT_ALLOWED"; reason: string }
  | { ok: false; code: "SLOT_TAKEN" | "SLOT_UNAVAILABLE"; message: string };

export async function rescheduleBooking(
  booking: Booking,
  newStartIso: string,
  actor: { kind: PolicyActor; id?: string | null },
  now: Date,
  db: Db = getDb(),
  opts: { resourceId?: string } = {},
): Promise<RescheduleResult> {
  const ctx = await loadBookingContext(db);
  const policy = canReschedule({
    startsAt: booking.startsAt.getTime(),
    now: now.getTime(),
    count: booking.rescheduleCount,
    status: booking.status,
    policy: ctx.settings.reschedule,
    actor: actor.kind,
  });
  if (!policy.ok) {
    const reason =
      policy.reason === "too_late"
        ? `Changes need at least ${ctx.settings.reschedule.minHoursBefore} hours' notice — please call or text us.`
        : policy.reason === "limit_reached"
          ? "This booking has already been rescheduled the maximum number of times — please contact us."
          : "Only confirmed bookings can be rescheduled.";
    return { ok: false, code: "NOT_ALLOWED", reason };
  }

  const startMs = Date.parse(newStartIso);
  const zone = ctx.schedule.zones.find((z) => z.id === booking.zoneId);
  const travel = booking.locationType === "mobile" ? (zone?.travelMinutes ?? 0) : 0;
  const blocked = blockedRange(startMs, booking.durationMin, travel, ctx.settings.bufferMin);
  const resourceIds = eligibleResourceIds(ctx, booking.locationType);
  const alloc = await activeAllocation(db, booking.id);
  if (!alloc) return { ok: false, code: "NOT_ALLOWED", reason: "This booking has no active time slot." };

  // Customers may only pick offered slots; admins may place any time (still conflict-checked by the DB).
  let candidates = resourceIds;
  if (actor.kind !== "admin") {
    const allocations = await loadAllocations(
      db,
      resourceIds,
      new Date(blocked.start - 24 * 60 * MINUTE),
      new Date(blocked.end + 24 * 60 * MINUTE),
      { excludeBookingId: booking.id },
    );
    candidates = freeResourcesAt(
      {
        durationMin: booking.durationMin,
        travelMin: travel,
        resourceIds,
        allocations,
        hours: ctx.schedule.hours,
        blackoutDates: ctx.schedule.blackoutDates.map((b) => b.date),
        settings: availabilitySettings(ctx.settings),
        now: now.getTime(),
      },
      new Date(startMs).toISOString(),
    );
    if (candidates.length === 0) return { ok: false, code: "SLOT_UNAVAILABLE", message: "That time isn't available any more." };
  }
  // Order: explicitly requested crew/bay (admin drag), then the current one, then the rest.
  const allowed = new Set(candidates);
  candidates = [...new Set([opts.resourceId, alloc.resourceId, ...candidates])].filter(
    (r): r is string => !!r && resourceIds.includes(r) && allowed.has(r),
  );

  const previousStart = booking.startsAt;
  const updated = await retryOnDeadlock(() => db.transaction(async (tx) => {
    await lockResources(tx, resourceIds);
    let moved = false;
    for (const resourceId of candidates) {
      try {
        // One UPDATE: the old period is released and the new one claimed atomically.
        await tx.transaction(async (sp) => {
          await sp
            .update(s.resourceAllocations)
            .set({ resourceId, period: { start: new Date(blocked.start), end: new Date(blocked.end) }, updatedAt: now })
            .where(eq(s.resourceAllocations.id, alloc.id));
        });
        moved = true;
        break;
      } catch (err) {
        if (pgErrorCode(err) === EXCLUSION_VIOLATION) continue;
        throw err;
      }
    }
    if (!moved) return null;
    const row = await transition(tx, {
      bookingId: booking.id,
      event: "reschedule",
      actor: actor.kind as Actor,
      actorId: actor.id ?? null,
      at: now,
      data: { from: previousStart.toISOString(), to: new Date(startMs).toISOString() },
      set: {
        startsAt: new Date(startMs),
        endsAt: new Date(startMs + booking.durationMin * MINUTE),
        rescheduleCount: booking.rescheduleCount + (actor.kind === "admin" ? 0 : 1),
      },
    });
    if (!row) throw new Error("reschedule transition failed");
    await enqueueBookingRescheduled(tx, row, previousStart, ctx.settings, now);
    return row;
  }));

  if (!updated) return { ok: false, code: "SLOT_TAKEN", message: "Someone just booked that time — please pick another." };
  return { ok: true, startsAt: updated.startsAt.toISOString() };
}

export async function previewCancellation(booking: Booking, actor: PolicyActor, now: Date, db: Db = getDb(), waiveFee?: boolean) {
  const ctx = await loadBookingContext(db);
  const paid = await depositPaidCents(db, booking.id);
  return {
    ...cancellationOutcome({
      startsAt: booking.startsAt.getTime(),
      now: now.getTime(),
      depositPaidCents: paid.cents,
      totalCents: booking.totalCents,
      policy: ctx.settings.cancellation,
      actor,
      waiveFee,
    }),
    windowHours: ctx.settings.cancellation.windowHours,
    depositPaidCents: paid.cents,
  };
}

export async function cancelBooking(
  booking: Booking,
  args: { actor: PolicyActor; actorId?: string | null; reason?: string; waiveFee?: boolean },
  now: Date,
  db: Db = getDb(),
) {
  const paid = await depositPaidCents(db, booking.id);
  const outcome = await previewCancellation(booking, args.actor, now, db, args.waiveFee);
  const row = await db.transaction(async (tx) => {
    const updated = await transition(tx, {
      bookingId: booking.id,
      event: "cancel",
      actor: args.actor as Actor,
      actorId: args.actorId ?? null,
      at: now,
      data: { late: outcome.late, feeCents: outcome.feeCents, refundCents: outcome.refundCents },
      set: {
        cancelledAt: now,
        cancelledBy: args.actor as Actor,
        cancelReason: args.reason ?? null,
        cancellationFeeCents: outcome.feeCents,
        feeOwedCents: outcome.feeOwedCents,
        refundCents: outcome.refundCents,
      },
    });
    if (!updated) return null;
    await tx
      .update(s.resourceAllocations)
      .set({ active: false, updatedAt: now })
      .where(and(eq(s.resourceAllocations.bookingId, booking.id), eq(s.resourceAllocations.active, true)));
    if (outcome.refundCents > 0 && paid.paymentId) {
      await queueRefund(tx, booking.id, paid.paymentId, paid.paymentIntentId, outcome.refundCents, "cancel", now);
    }
    await enqueueBookingCancelled(tx, updated, now);
    return updated;
  });
  if (!row) return { ok: false as const, message: "This booking can't be cancelled." };
  return { ok: true as const, ...outcome };
}

export async function adminSetStatus(
  booking: Booking,
  event: "start" | "complete" | "no_show",
  adminId: string,
  now: Date,
  db: Db = getDb(),
) {
  if (event === "no_show" && booking.startsAt.getTime() > now.getTime()) {
    return { ok: false as const, message: "A booking can only be marked as a no-show after its start time." };
  }
  const ctx = await loadBookingContext(db);
  const row = await db.transaction(async (tx) => {
    const updated = await transition(tx, {
      bookingId: booking.id,
      event,
      actor: "admin",
      actorId: adminId,
      at: now,
      set: event === "complete" ? { completedAt: now } : {},
    });
    if (!updated) return null;
    if (event === "complete") await enqueueReviewRequest(tx, updated, ctx.settings, now);
    if (event === "no_show" || event === "complete") {
      // Release resource time after the job so late changes don't block anything.
      await tx
        .update(s.resourceAllocations)
        .set({ holdExpiresAt: null, updatedAt: now })
        .where(eq(s.resourceAllocations.bookingId, booking.id));
    }
    return updated;
  });
  if (!row) return { ok: false as const, message: "That status change isn't allowed from the current status." };
  return { ok: true as const };
}

export async function recordBalancePayment(
  booking: Booking,
  args: { amountCents: number; method: "cash" | "card_terminal" | "other"; note?: string; adminId: string },
  now: Date,
  db: Db = getDb(),
) {
  await db.transaction(async (tx) => {
    await tx.insert(s.payments).values({
      bookingId: booking.id,
      kind: "balance",
      method: args.method,
      amountCents: args.amountCents,
      status: "succeeded",
      idempotencyKey: `balance:${booking.id}:${now.getTime()}`,
      note: args.note ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await tx
      .update(s.bookings)
      .set({ balancePaidCents: booking.balancePaidCents + args.amountCents, updatedAt: now })
      .where(eq(s.bookings.id, booking.id));
    await tx.insert(s.bookingEvents).values({
      bookingId: booking.id,
      type: "balance_paid",
      actor: "admin",
      actorId: args.adminId,
      data: { amountCents: args.amountCents, method: args.method },
      createdAt: now,
    });
  });
}
