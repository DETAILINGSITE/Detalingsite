/** Integration-test helpers: shared db handle, full reset + seed, fixed clock, quick fixtures. */
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { seed } from "@/db/seed";
import { setClockTo } from "@/lib/server/clock";
import { resetEnvCache } from "@/lib/env";

export const db = () => getDb();

/** Wipes every table (including bookings) and re-seeds. Deterministic hours for tests. */
export async function resetDb(opts: { hours?: { weekday: number; opens: string; closes: string }[]; settings?: Record<string, unknown> } = {}) {
  resetEnvCache();
  await db().execute(sql`TRUNCATE resource_allocations, booking_events, payments, outbox, leads, quote_photos, funnel_events, bookings, quote_requests, customers, webhook_events, rate_limits, cron_runs RESTART IDENTITY CASCADE`);
  await seed(db(), { reset: true });
  // Tests use a fixed timezone and simple Mon–Sat 08:00–18:00 hours unless overridden.
  await db().delete(s.businessHours);
  await db().insert(s.businessHours).values(
    opts.hours ?? [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "08:00", closes: "18:00" })),
  );
  await db().delete(s.blackoutDates);
  const [row] = await db().select().from(s.settings).where(eq(s.settings.id, 1));
  await db()
    .update(s.settings)
    .set({ data: { ...row!.data, timezone: "America/Chicago", minLeadHours: 0, maxDaysAhead: 120, ...(opts.settings ?? {}) } as typeof row.data })
    .where(eq(s.settings.id, 1));
}

/** Pin the app clock (TEST_CLOCK=1 in vitest config). */
export function at(iso: string) {
  setClockTo(Date.parse(iso));
  return new Date(iso);
}

export async function ids() {
  const services = await db().select().from(s.services);
  const packages = await db().select().from(s.packages);
  const resources = await db().select().from(s.resources);
  const bySlug = (slug: string) => services.find((x) => x.slug === slug)!.id;
  const pkg = (slug: string) => packages.find((x) => x.slug === slug)!.id;
  return { bySlug, pkg, resources };
}

export const shopLocation = { locationType: "shop" as const };
export const mobileLocation = (zip = "00010") => ({
  locationType: "mobile" as const,
  address: { line1: "1 Test Street", city: "Downtown", region: "TX", postalCode: zip, country: "US" as const },
  hasWater: true,
  hasPower: true,
});

export const attribution = { utmSource: "test" };
