import { getDb, type Db } from "@/db/client";
import { computeAvailability, type DayAvailability } from "@/lib/domain/availability";
import { Temporal, todayIn, zoneAbbreviation } from "@/lib/domain/time";
import type { SelectionInput } from "@/lib/validation/booking";
import { availabilitySettings, loadAllocations, loadBookingContext } from "./context";
import { planJob, type HoldError } from "./holds";

export interface AvailabilityQuery {
  selection: SelectionInput;
  locationType: "mobile" | "shop";
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  fromDate?: string | null;
  days?: number;
  quoteToken?: string | null;
  /** When rescheduling, the booking's own allocation must not block its new time. */
  excludeBookingId?: string | null;
  durationOverrideMin?: number | null;
}

export type AvailabilityResponse =
  | {
      ok: true;
      timezone: string;
      zoneLabel: string;
      durationMin: number;
      firstBookableDate: string;
      lastBookableDate: string;
      days: DayAvailability[];
      nextAvailable: { date: string; start: string; label: string } | null;
    }
  | HoldError;

export async function getAvailability(q: AvailabilityQuery, now: Date, db: Db = getDb()): Promise<AvailabilityResponse> {
  const ctx = await loadBookingContext(db);
  const location =
    q.locationType === "mobile"
      ? {
          locationType: "mobile" as const,
          address: {
            line1: "-",
            city: "-",
            region: "-",
            postalCode: q.zip ?? "",
            country: "US" as const,
            ...(q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng } : {}),
          },
          hasWater: true,
          hasPower: true,
        }
      : { locationType: "shop" as const };
  const plan = await planJob(db, ctx, { selection: q.selection, location, quoteToken: q.quoteToken }, now);
  if (!plan.ok) return plan.error;

  const tz = ctx.settings.timezone;
  const today = todayIn(tz, now.getTime());
  const last = today.add({ days: ctx.settings.maxDaysAhead });
  let from = q.fromDate ? Temporal.PlainDate.from(q.fromDate) : today;
  if (Temporal.PlainDate.compare(from, today) < 0) from = today;
  const span = Math.min(Math.max(q.days ?? 35, 1), 62);
  let to = from.add({ days: span - 1 });
  if (Temporal.PlainDate.compare(to, last) > 0) to = last;

  const durationMin = q.durationOverrideMin ?? plan.price.durationMin;
  const windowFrom = new Date(from.subtract({ days: 1 }).toZonedDateTime({ timeZone: tz }).epochMilliseconds);
  const windowTo = new Date(to.add({ days: 2 }).toZonedDateTime({ timeZone: tz }).epochMilliseconds);
  const allocations = await loadAllocations(db, plan.resourceIds, windowFrom, windowTo, {
    excludeBookingId: q.excludeBookingId ?? undefined,
  });
  const days = computeAvailability({
    fromDate: from.toString(),
    toDate: to.toString(),
    durationMin,
    travelMin: plan.travelMinutes,
    resourceIds: plan.resourceIds,
    allocations,
    hours: ctx.schedule.hours,
    blackoutDates: ctx.schedule.blackoutDates.map((b) => b.date),
    settings: availabilitySettings(ctx.settings),
    now: now.getTime(),
  });
  const firstSlot = days[0]?.slots[0];
  return {
    ok: true,
    timezone: tz,
    zoneLabel: zoneAbbreviation(now.getTime(), tz),
    durationMin,
    firstBookableDate: today.toString(),
    lastBookableDate: last.toString(),
    days: days.map((d) => ({ date: d.date, slots: d.slots.map(({ freeResourceIds: _, ...rest }) => ({ ...rest, freeResourceIds: [] })) })),
    nextAvailable: firstSlot && days[0] ? { date: days[0].date, start: firstSlot.start, label: firstSlot.label } : null,
  };
}
