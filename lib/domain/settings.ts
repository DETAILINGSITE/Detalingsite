import { z } from "zod";

/** "HH:MM" 24-hour wall-clock time. */
export const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const IanaTimeZone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown IANA time zone");

export const ServiceMode = z.enum(["mobile", "shop", "both"]);
export type ServiceMode = z.infer<typeof ServiceMode>;

export const DepositPolicy = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("fixed"), valueCents: z.number().int().min(0) }),
  z.object({ mode: z.literal("percent"), percent: z.number().min(0).max(100) }),
]);
export type DepositPolicy = z.infer<typeof DepositPolicy>;

export const LateFee = z.discriminatedUnion("type", [
  z.object({ type: z.literal("forfeit_deposit") }),
  z.object({ type: z.literal("fixed"), cents: z.number().int().min(0) }),
  z.object({ type: z.literal("percent"), percent: z.number().min(0).max(100) }),
]);
export type LateFee = z.infer<typeof LateFee>;

/**
 * Operational settings: seeded from config/business.ts, then owned by the admin
 * dashboard (docs/PLAN.md §0). Stored as one validated JSON row in `settings`.
 */
export const OperationalSettingsSchema = z.object({
  timezone: IanaTimeZone,
  serviceMode: ServiceMode,
  slotIntervalMin: z.number().int().min(5).max(240),
  bufferMin: z.number().int().min(0).max(240),
  minLeadHours: z.number().min(0).max(24 * 30),
  maxDaysAhead: z.number().int().min(1).max(365),
  holdMinutes: z.number().int().min(2).max(60),
  holdExtensionMinutes: z.number().int().min(0).max(30),
  holdMaxTotalMinutes: z.number().int().min(5).max(90),
  paymentHoldMinutes: z.number().int().min(5).max(60),
  travelCountsAgainstHours: z.boolean(),
  base: z.object({
    label: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  deposit: DepositPolicy,
  cancellation: z.object({
    windowHours: z.number().min(0).max(24 * 14),
    lateFee: LateFee,
  }),
  reschedule: z.object({
    minHoursBefore: z.number().min(0).max(24 * 14),
    maxCount: z.number().int().min(0).max(10),
  }),
  taxRateBps: z.number().int().min(0).max(2500),
  taxTravel: z.boolean(),
  priceRoundingCents: z.number().int().min(1).max(10_000),
  reminders: z.object({
    hoursBefore: z.array(z.number().min(0.5).max(24 * 7)).max(4),
    reviewDelayHours: z.number().min(0).max(24 * 14),
    smsQuietStart: HHMM,
    smsQuietEnd: HHMM,
  }),
  quoteValidityDays: z.number().int().min(1).max(90),
  leadRetentionMonths: z.number().int().min(1).max(120),
  /** The owner ticks this in admin once real prices/durations replace the seed placeholders. */
  catalogReviewed: z.boolean(),
});
export type OperationalSettings = z.infer<typeof OperationalSettingsSchema>;

export const BusinessHoursRow = z.object({
  /** ISO weekday: 1 = Monday … 7 = Sunday (matches Temporal). */
  weekday: z.number().int().min(1).max(7),
  opens: HHMM,
  closes: HHMM,
});
export type BusinessHoursRow = z.infer<typeof BusinessHoursRow>;

/** Longest single opening interval — the longest job that can be booked online. */
export function longestIntervalMinutes(hours: readonly BusinessHoursRow[]): number {
  let max = 0;
  for (const h of hours) max = Math.max(max, hhmmToMinutes(h.closes) - hhmmToMinutes(h.opens));
  return max;
}
