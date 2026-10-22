import { asc, eq } from "drizzle-orm";
import { business } from "@/config/business";
import type { Queryable } from "@/db/client";
import * as s from "@/db/schema";
import {
  OperationalSettingsSchema,
  longestIntervalMinutes,
  type BusinessHoursRow,
  type OperationalSettings,
} from "@/lib/domain/settings";
import type { Zone } from "@/lib/domain/zones";

export async function loadSettings(db: Queryable): Promise<OperationalSettings> {
  const [row] = await db.select().from(s.settings).where(eq(s.settings.id, 1));
  // Fall back to the config defaults if the DB was never seeded (fresh dev setups).
  const parsed = OperationalSettingsSchema.safeParse(row?.data ?? business.defaults.settings);
  if (!parsed.success) throw new Error(`settings row is invalid: ${parsed.error.message}`);
  return parsed.data;
}

const hhmm = (t: string) => t.slice(0, 5);

export interface Schedule {
  hours: BusinessHoursRow[];
  blackoutDates: { date: string; reason: string }[];
  resources: { id: string; name: string; type: "mobile_crew" | "shop_bay"; active: boolean; sort: number; color: string }[];
  zones: Zone[];
  zoneCities: Record<string, string[]>;
  maxJobMinutes: number;
}

export async function loadSchedule(db: Queryable): Promise<Schedule> {
  const [hours, blackouts, resources, zones] = await Promise.all([
    db.select().from(s.businessHours).orderBy(asc(s.businessHours.weekday), asc(s.businessHours.opens)),
    db.select().from(s.blackoutDates).orderBy(asc(s.blackoutDates.date)),
    db.select().from(s.resources).orderBy(asc(s.resources.sort)),
    db.select().from(s.serviceZones).orderBy(asc(s.serviceZones.sort)),
  ]);
  const hoursRows = hours.map((h) => ({ weekday: h.weekday, opens: hhmm(h.opens), closes: hhmm(h.closes) }));
  return {
    hours: hoursRows,
    blackoutDates: blackouts.map((b) => ({ date: b.date, reason: b.reason })),
    resources: resources.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      active: r.active,
      sort: r.sort,
      color: r.color,
    })),
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      zipCodes: z.zipCodes,
      ringMaxKm: z.ringMaxKm,
      travelFeeCents: z.travelFeeCents,
      travelMinutes: z.travelMinutes,
      sort: z.sort,
      active: z.active,
    })),
    zoneCities: Object.fromEntries(zones.map((z) => [z.id, z.cities])),
    maxJobMinutes: longestIntervalMinutes(hoursRows),
  };
}

export function resourceTypeFor(locationType: "mobile" | "shop") {
  return locationType === "mobile" ? ("mobile_crew" as const) : ("shop_bay" as const);
}

export function serviceModeAllows(mode: OperationalSettings["serviceMode"], locationType: "mobile" | "shop") {
  return mode === "both" || mode === locationType;
}
