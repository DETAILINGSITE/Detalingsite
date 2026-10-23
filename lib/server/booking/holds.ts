/**
 * Slot holds (docs/PLAN.md §5.3). The exclusion constraint `no_double_booking` is the
 * real guarantee; the availability re-check here only picks which crews/bays to try.
 */
import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { business } from "@/config/business";
import { EXCLUSION_VIOLATION, getDb, lockResources, pgErrorCode, retryOnDeadlock, type Db, type Queryable } from "@/db/client";
import * as s from "@/db/schema";
import {
  blockedRange,
  computeAvailability,
  freeResourcesAt,
  nearestSlots,
  type Slot,
} from "@/lib/domain/availability";
import { bookingNumber } from "@/lib/domain/ids";
import { price, describePriceError, type PriceResult } from "@/lib/domain/pricing";
import { localDateOf, MINUTE, Temporal } from "@/lib/domain/time";
import { env } from "@/lib/env";
import type { Attribution, LocationInput, SelectionInput } from "@/lib/validation/booking";
import { recordFunnel } from "../funnel";
import { enqueue } from "../outbox";
import { deriveToken, hashToken, looksLikeToken, newId } from "../tokens";
import {
  availabilitySettings,
  eligibleResourceIds,
  loadAllocations,
  loadBookingContext,
  type BookingContext,
} from "./context";
import { maxZoneTravel, resolveLocation } from "./location";
import { pricingContext, quoteTermsFrom } from "./pricing";
import { loadBookableQuote } from "./quotes-lookup";
import { transition } from "./transition";

export interface HoldRequest {
  idempotencyKey: string;
  sessionId: string;
  selection: SelectionInput;
  vehicle: { year?: string; make?: string; model?: string; color?: string };
  location: LocationInput;
  slotStart: string;
  quoteToken?: string | null;
  attribution: Attribution;
}

export type HoldError =
  | { ok: false; code: "SLOT_TAKEN"; message: string; alternatives: Slot[] }
  | { ok: false; code: "SLOT_UNAVAILABLE"; message: string; alternatives: Slot[] }
  | { ok: false; code: "OUT_OF_AREA" | "LOCATION_TYPE_UNAVAILABLE"; message: string }
  | { ok: false; code: "PRICE_ERRORS"; message: string; errors: string[] }
  | { ok: false; code: "QUOTE_ROUTE"; message: string; price: PriceResult }
  | { ok: false; code: "QUOTE_INVALID"; message: string }
  | { ok: false; code: "HOLD_EXPIRED"; message: string };

export type HoldSuccess = {
  ok: true;
  bookingId: string;
  number: string;
  token: string;
  holdExpiresAt: string;
  startsAt: string;
  endsAt: string;
  price: PriceResult;
};

class SlotTakenError extends Error {}

export function manageTokenFor(bookingId: string, version: number) {
  return deriveToken(env().TOKEN_PEPPER, "manage", bookingId, version);
}

/** Expire lapsed holds (optionally only those overlapping a range on some resources). */
export async function sweepExpiredHolds(
  tx: Queryable,
  now: Date,
  scope?: { resourceIds: string[]; start: Date; end: Date },
): Promise<string[]> {
  const ra = s.resourceAllocations;
  const conds = [eq(ra.active, true), isNotNull(ra.holdExpiresAt), lte(ra.holdExpiresAt, now)];
  if (scope) {
    if (scope.resourceIds.length === 0) return [];
    conds.push(inArray(ra.resourceId, scope.resourceIds));
    conds.push(
      sql`${ra.period} && tstzrange(${scope.start.toISOString()}::timestamptz, ${scope.end.toISOString()}::timestamptz, '[)')`,
    );
  }
  const released = await tx
    .update(ra)
    .set({ active: false, updatedAt: now })
    .where(and(...conds))
    .returning({ bookingId: ra.bookingId });

  const expired: string[] = [];
  for (const { bookingId } of released) {
    if (!bookingId) continue;
    const row = await transition(tx, {
      bookingId,
      event: "expire",
      actor: "system",
      at: now,
      data: { reason: "hold_lapsed" },
    });
    if (!row) continue;
    expired.push(bookingId);
    await afterExpire(tx, row, now);
  }
  return expired;
}

async function afterExpire(tx: Queryable, booking: typeof s.bookings.$inferSelect, now: Date) {
  // Close any open Checkout Session so it can't be paid later (late payments are still handled).
  const open = await tx
    .select()
    .from(s.payments)
    .where(and(eq(s.payments.bookingId, booking.id), eq(s.payments.status, "open")));
  for (const p of open) {
    if (!p.stripeCheckoutSessionId) continue;
    await enqueue(tx, {
      type: "stripe.expire_session",
      payload: { paymentId: p.id, sessionId: p.stripeCheckoutSessionId },
      runAt: now,
      dedupeKey: `payment:${p.id}:expire`,
      bookingId: booking.id,
    });
  }
  // Abandoned booking → lead, only with the customer's consent (docs/PLAN.md §5).
  if (booking.customerId && booking.leadConsentAt) {
    const [c] = await tx.select().from(s.customers).where(eq(s.customers.id, booking.customerId));
    if (c) {
      await tx
        .insert(s.leads)
        .values({
          source: "booking_abandoned",
          name: c.name,
          email: c.email,
          phoneE164: c.phoneE164,
          message: `Started booking ${booking.number} for ${new Date(booking.startsAt).toISOString()} but didn't finish.`,
          customerId: c.id,
          bookingId: booking.id,
          consentContactAt: booking.leadConsentAt,
          attribution: booking.attribution,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }
  }
}

function dayWindow(startMs: number, tz: string) {
  const date = Temporal.PlainDate.from(localDateOf(startMs, tz));
  const from = date.subtract({ days: 1 }).toZonedDateTime({ timeZone: tz }).epochMilliseconds;
  const to = date.add({ days: 2 }).toZonedDateTime({ timeZone: tz }).epochMilliseconds;
  return { from: new Date(from), to: new Date(to) };
}

/** Everything needed to price + place a job, shared by holds and the availability API. */
export async function planJob(
  db: Queryable,
  ctx: BookingContext,
  req: Pick<HoldRequest, "selection" | "location" | "quoteToken">,
  now: Date,
) {
  let quote = null as Awaited<ReturnType<typeof loadBookableQuote>> | null;
  if (req.quoteToken) {
    quote = await loadBookableQuote(db, req.quoteToken, now);
    if (!quote.ok) {
      return {
        ok: false as const,
        error: {
          ok: false as const,
          code: "QUOTE_INVALID" as const,
          message:
            quote.reason === "expired"
              ? "This quote has expired — please contact us for an updated price."
              : quote.reason === "accepted"
                ? "This quote has already been booked."
                : "This quote link isn't valid.",
        },
      };
    }
  }

  // Quoted jobs use the owner's location/vehicle; out-of-area quotes may have no zone.
  let locationType: "mobile" | "shop";
  let zone = null as import("@/lib/domain/zones").Zone | null;
  let address = null as s.AddressJson | null;
  let accessNotes: string | null = null;
  let travelMinutes = 0;
  if (quote?.ok) {
    const q = quote.quote;
    locationType = q.locationType;
    zone = ctx.schedule.zones.find((z) => z.id === q.zoneId) ?? null;
    address = q.address ?? null;
    travelMinutes = locationType === "mobile" ? (zone?.travelMinutes ?? maxZoneTravel(ctx)) : 0;
  } else {
    const loc = resolveLocation(ctx, req.location);
    if (!loc.ok) return { ok: false as const, error: { ok: false as const, code: loc.code, message: loc.message } };
    locationType = loc.locationType;
    zone = loc.zone;
    address = loc.address;
    accessNotes = loc.accessNotes;
    travelMinutes = loc.travelMinutes;
  }

  const sizeId = quote?.ok ? (quote.quote.vehicleSizeId ?? req.selection.sizeId) : req.selection.sizeId;
  const selection = { ...req.selection, sizeId };
  const result = price(
    { ...selection, locationType },
    pricingContext(ctx, { zone, quote: quote?.ok ? quoteTermsFrom(quote.quote) : null }),
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error: {
        ok: false as const,
        code: "PRICE_ERRORS" as const,
        message: "Please review your selection.",
        errors: result.errors.map(describePriceError),
      },
    };
  }
  if (result.route === "quote") {
    return {
      ok: false as const,
      error: {
        ok: false as const,
        code: "QUOTE_ROUTE" as const,
        message: "This job needs a custom quote.",
        price: result,
      },
    };
  }
  return {
    ok: true as const,
    quote: quote?.ok ? quote.quote : null,
    selection,
    locationType,
    zone,
    address,
    accessNotes,
    travelMinutes,
    price: result,
    resourceIds: eligibleResourceIds(ctx, locationType),
  };
}

export async function createHold(req: HoldRequest, now: Date, db: Db = getDb()): Promise<HoldSuccess | HoldError> {
  const ctx = await loadBookingContext(db);

  // Idempotent replay (double click / retried request).
  const [existing] = await db
    .select()
    .from(s.bookings)
    .where(eq(s.bookings.idempotencyKey, req.idempotencyKey));
  if (existing) return replayHold(db, existing, now);

  const plan = await planJob(db, ctx, req, now);
  if (!plan.ok) return plan.error;

  const startMs = Date.parse(req.slotStart);
  const tz = ctx.settings.timezone;
  const blocked = blockedRange(startMs, plan.price.durationMin, plan.travelMinutes, ctx.settings.bufferMin);
  const window = dayWindow(startMs, tz);
  const id = newId();
  const token = manageTokenFor(id, 1);
  const holdExpiresAt = new Date(now.getTime() + ctx.settings.holdMinutes * MINUTE);
  const endsAt = new Date(startMs + plan.price.durationMin * MINUTE);
  const sizeLabel = ctx.catalog.sizes.find((z) => z.id === plan.selection.sizeId)?.label ?? plan.selection.sizeId;

  try {
    const booking = await retryOnDeadlock(() => db.transaction(async (tx) => {
      await lockResources(tx, plan.resourceIds);
      await sweepExpiredHolds(tx, now, {
        resourceIds: plan.resourceIds,
        start: new Date(blocked.start),
        end: new Date(blocked.end),
      });

      const allocations = await loadAllocations(tx, plan.resourceIds, window.from, window.to);
      const free = freeResourcesAt(
        {
          durationMin: plan.price.durationMin,
          travelMin: plan.travelMinutes,
          resourceIds: plan.resourceIds,
          allocations,
          hours: ctx.schedule.hours,
          blackoutDates: ctx.schedule.blackoutDates.map((b) => b.date),
          settings: availabilitySettings(ctx.settings),
          now: now.getTime(),
        },
        new Date(startMs).toISOString(),
      );
      if (free.length === 0) throw new SlotTakenError();

      const [row] = await tx
        .insert(s.bookings)
        .values({
          id,
          number: bookingNumber(business.bookingPrefix),
          status: "held",
          customerId: plan.quote?.customerId ?? null,
          quoteRequestId: plan.quote?.id ?? null,
          source: plan.quote ? "quote" : "web",
          locationType: plan.locationType,
          address: plan.address,
          accessNotes: plan.accessNotes,
          zoneId: plan.zone?.id ?? null,
          vehicleSizeId: plan.selection.sizeId,
          vehicleYear: req.vehicle.year ? Number(req.vehicle.year) : (plan.quote?.vehicleYear ?? null),
          vehicleMake: req.vehicle.make || plan.quote?.vehicleMake || null,
          vehicleModel: req.vehicle.model || plan.quote?.vehicleModel || null,
          vehicleColor: req.vehicle.color || plan.quote?.vehicleColor || null,
          conditionIds: plan.selection.conditionIds,
          selection: plan.selection,
          priceSnapshot: { ...plan.price, sizeLabel, computedAt: now.toISOString() },
          subtotalCents: plan.price.subtotalCents,
          surchargeCents: plan.price.surchargeCents,
          travelFeeCents: plan.price.travelFeeCents,
          discountCents: plan.price.discountCents,
          taxCents: plan.price.taxCents,
          totalCents: plan.price.totalCents,
          depositCents: plan.price.depositCents,
          durationMin: plan.price.durationMin,
          startsAt: new Date(startMs),
          endsAt,
          timezone: tz,
          manageTokenHash: hashToken(token),
          manageTokenVersion: 1,
          idempotencyKey: req.idempotencyKey,
          attribution: req.attribution,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("booking insert failed");

      // Least-loaded crew/bay first, so work spreads evenly.
      const load = new Map<string, number>();
      for (const a of allocations) load.set(a.resourceId, (load.get(a.resourceId) ?? 0) + 1);
      const ordered = [...free].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));

      let allocated = false;
      for (const resourceId of ordered) {
        try {
          await tx.transaction(async (sp) => {
            await sp.insert(s.resourceAllocations).values({
              resourceId,
              kind: "booking",
              bookingId: id,
              period: { start: new Date(blocked.start), end: new Date(blocked.end) },
              active: true,
              holdExpiresAt,
              createdAt: now,
              updatedAt: now,
            });
          });
          allocated = true;
          break;
        } catch (err) {
          if (pgErrorCode(err) === EXCLUSION_VIOLATION) continue;
          throw err;
        }
      }
      if (!allocated) throw new SlotTakenError();

      await tx.insert(s.bookingEvents).values({
        bookingId: id,
        type: "hold_created",
        toStatus: "held",
        actor: "customer",
        data: { slotStart: req.slotStart, holdExpiresAt: holdExpiresAt.toISOString() },
        createdAt: now,
      });
      return row;
    }));

    await recordFunnel(db, { sessionId: req.sessionId, event: "hold_created", step: "schedule", bookingId: id, at: now, utmSource: req.attribution.utmSource });

    return {
      ok: true,
      bookingId: booking.id,
      number: booking.number,
      token,
      holdExpiresAt: holdExpiresAt.toISOString(),
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      price: plan.price,
    };
  } catch (err) {
    if (err instanceof SlotTakenError) {
      const alternatives = await alternativesNear(db, ctx, plan, startMs, now);
      return {
        ok: false,
        code: "SLOT_TAKEN",
        message: "Someone just booked that time. Here are the closest times still open.",
        alternatives,
      };
    }
    throw err;
  }
}

async function alternativesNear(
  db: Queryable,
  ctx: BookingContext,
  plan: { price: PriceResult; travelMinutes: number; resourceIds: string[] },
  startMs: number,
  now: Date,
): Promise<Slot[]> {
  const tz = ctx.settings.timezone;
  const date = Temporal.PlainDate.from(localDateOf(startMs, tz));
  const from = date.subtract({ days: 3 });
  const to = date.add({ days: 7 });
  const allocations = await loadAllocations(
    db,
    plan.resourceIds,
    new Date(from.toZonedDateTime({ timeZone: tz }).epochMilliseconds),
    new Date(to.add({ days: 1 }).toZonedDateTime({ timeZone: tz }).epochMilliseconds),
  );
  const days = computeAvailability({
    fromDate: from.toString(),
    toDate: to.toString(),
    durationMin: plan.price.durationMin,
    travelMin: plan.travelMinutes,
    resourceIds: plan.resourceIds,
    allocations,
    hours: ctx.schedule.hours,
    blackoutDates: ctx.schedule.blackoutDates.map((b) => b.date),
    settings: availabilitySettings(ctx.settings),
    now: now.getTime(),
  });
  return nearestSlots(days, new Date(startMs).toISOString(), 3);
}

async function replayHold(db: Queryable, booking: typeof s.bookings.$inferSelect, now: Date): Promise<HoldSuccess | HoldError> {
  const [alloc] = await db
    .select()
    .from(s.resourceAllocations)
    .where(and(eq(s.resourceAllocations.bookingId, booking.id), eq(s.resourceAllocations.active, true)));
  const live = alloc && (!alloc.holdExpiresAt || alloc.holdExpiresAt > now);
  if (!live || !["held", "pending_payment"].includes(booking.status)) {
    return { ok: false, code: "HOLD_EXPIRED", message: "Your hold on that time has expired. Please pick a time again." };
  }
  return {
    ok: true,
    bookingId: booking.id,
    number: booking.number,
    token: manageTokenFor(booking.id, booking.manageTokenVersion),
    holdExpiresAt: (alloc.holdExpiresAt ?? now).toISOString(),
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    price: booking.priceSnapshot,
  };
}

export async function findBookingByToken(db: Queryable, token: string) {
  if (!looksLikeToken(token)) return null;
  const [row] = await db.select().from(s.bookings).where(eq(s.bookings.manageTokenHash, hashToken(token)));
  return row ?? null;
}

export async function activeAllocation(db: Queryable, bookingId: string) {
  const [alloc] = await db
    .select()
    .from(s.resourceAllocations)
    .where(and(eq(s.resourceAllocations.bookingId, bookingId), eq(s.resourceAllocations.active, true)));
  return alloc ?? null;
}

/** A hold the customer can still act on: held/pending_payment with a live allocation. */
export async function loadLiveHold(db: Queryable, token: string, now: Date) {
  const booking = await findBookingByToken(db, token);
  if (!booking) return { ok: false as const, code: "NOT_FOUND" as const };
  if (!["held", "pending_payment"].includes(booking.status))
    return { ok: false as const, code: "NOT_HELD" as const, booking };
  const alloc = await activeAllocation(db, booking.id);
  if (!alloc || (alloc.holdExpiresAt && alloc.holdExpiresAt <= now))
    return { ok: false as const, code: "HOLD_EXPIRED" as const, booking };
  return { ok: true as const, booking, alloc };
}

/** One "Need more time?" extension, capped at holdMaxTotalMinutes from creation. */
export async function extendHold(token: string, now: Date, db: Db = getDb()) {
  const ctx = await loadBookingContext(db);
  const live = await loadLiveHold(db, token, now);
  if (!live.ok) return { ok: false as const, code: live.code };
  if (live.booking.holdExtensions >= 1 || live.booking.status !== "held")
    return { ok: false as const, code: "LIMIT" as const };
  const cap = live.booking.createdAt.getTime() + ctx.settings.holdMaxTotalMinutes * MINUTE;
  const next = Math.min(
    (live.alloc.holdExpiresAt?.getTime() ?? now.getTime()) + ctx.settings.holdExtensionMinutes * MINUTE,
    cap,
  );
  await db.transaction(async (tx) => {
    await tx
      .update(s.resourceAllocations)
      .set({ holdExpiresAt: new Date(next), updatedAt: now })
      .where(eq(s.resourceAllocations.id, live.alloc.id));
    await tx
      .update(s.bookings)
      .set({ holdExtensions: live.booking.holdExtensions + 1, updatedAt: now })
      .where(eq(s.bookings.id, live.booking.id));
  });
  return { ok: true as const, holdExpiresAt: new Date(next).toISOString() };
}

/** Customer changed slot/selection: release the old hold immediately. */
export async function releaseHold(token: string, now: Date, db: Db = getDb()) {
  const booking = await findBookingByToken(db, token);
  if (!booking || !["held", "pending_payment"].includes(booking.status)) return { ok: true as const };
  await db.transaction(async (tx) => {
    await tx
      .update(s.resourceAllocations)
      .set({ active: false, updatedAt: now })
      .where(and(eq(s.resourceAllocations.bookingId, booking.id), eq(s.resourceAllocations.active, true)));
    const row = await transition(tx, {
      bookingId: booking.id,
      event: "expire",
      actor: "customer",
      at: now,
      data: { reason: "released_by_customer" },
    });
    if (row) {
      const open = await tx
        .select()
        .from(s.payments)
        .where(and(eq(s.payments.bookingId, booking.id), eq(s.payments.status, "open")));
      for (const p of open) {
        if (p.stripeCheckoutSessionId)
          await enqueue(tx, {
            type: "stripe.expire_session",
            payload: { paymentId: p.id, sessionId: p.stripeCheckoutSessionId },
            runAt: now,
            dedupeKey: `payment:${p.id}:expire`,
            bookingId: booking.id,
          });
      }
    }
  });
  return { ok: true as const };
}
