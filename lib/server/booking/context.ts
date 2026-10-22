import { and, eq, inArray, sql } from "drizzle-orm";
import type { Queryable } from "@/db/client";
import * as s from "@/db/schema";
import type { AllocationSpan, AvailabilitySettings } from "@/lib/domain/availability";
import type { OperationalSettings } from "@/lib/domain/settings";
import { loadCatalog, toEngineCatalog, type CatalogView } from "../data/catalog";
import { loadSchedule, loadSettings, resourceTypeFor, type Schedule } from "../data/settings";

export interface BookingContext {
  settings: OperationalSettings;
  catalog: CatalogView;
  schedule: Schedule;
}

export async function loadBookingContext(db: Queryable): Promise<BookingContext> {
  const [settings, catalog, schedule] = await Promise.all([
    loadSettings(db),
    loadCatalog(db, { activeOnly: false }),
    loadSchedule(db),
  ]);
  return { settings, catalog, schedule };
}

export function engineCatalog(ctx: BookingContext) {
  return toEngineCatalog(ctx.catalog);
}

export function availabilitySettings(settings: OperationalSettings): AvailabilitySettings {
  return {
    timezone: settings.timezone,
    slotIntervalMin: settings.slotIntervalMin,
    bufferMin: settings.bufferMin,
    minLeadHours: settings.minLeadHours,
    maxDaysAhead: settings.maxDaysAhead,
    travelCountsAgainstHours: settings.travelCountsAgainstHours,
  };
}

export function eligibleResourceIds(ctx: BookingContext, locationType: "mobile" | "shop"): string[] {
  const type = resourceTypeFor(locationType);
  return ctx.schedule.resources.filter((r) => r.active && r.type === type).map((r) => r.id);
}

/** Active allocations on `resourceIds` overlapping [from, to). Expired holds are included; the engine filters them. */
export async function loadAllocations(
  db: Queryable,
  resourceIds: string[],
  from: Date,
  to: Date,
  opts: { excludeBookingId?: string } = {},
): Promise<AllocationSpan[]> {
  if (resourceIds.length === 0) return [];
  const ra = s.resourceAllocations;
  const rows = await db
    .select({
      resourceId: ra.resourceId,
      period: ra.period,
      holdExpiresAt: ra.holdExpiresAt,
      bookingId: ra.bookingId,
    })
    .from(ra)
    .where(
      and(
        eq(ra.active, true),
        inArray(ra.resourceId, resourceIds),
        sql`${ra.period} && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)')`,
      ),
    );
  return rows
    .filter((r) => !opts.excludeBookingId || r.bookingId !== opts.excludeBookingId)
    .map((r) => ({
      resourceId: r.resourceId,
      start: r.period.start.getTime(),
      end: r.period.end.getTime(),
      holdExpiresAt: r.holdExpiresAt ? r.holdExpiresAt.getTime() : null,
    }));
}
