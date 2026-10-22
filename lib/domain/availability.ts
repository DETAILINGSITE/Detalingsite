/**
 * Availability / slot engine (docs/PLAN.md §5.2). Pure: callers pass in hours,
 * blackouts, resources and existing allocations; nothing here touches the DB.
 *
 * The same `blockedRange()` is used by hold acquisition, so the slots we offer and
 * the ranges the database constraint enforces can never disagree.
 */
import type { BusinessHoursRow } from "./settings";
import { hhmmToMinutes } from "./settings";
import { MINUTE, HOUR, Temporal, formatTime, todayIn, wallTimeToEpoch, wallTimeToEpochLenient } from "./time";

export interface AllocationSpan {
  resourceId: string;
  /** Blocked range [start, end) in epoch ms. */
  start: number;
  end: number;
  /** Holds expire; null for confirmed bookings and admin blocks. */
  holdExpiresAt?: number | null;
}

export interface AvailabilitySettings {
  timezone: string;
  slotIntervalMin: number;
  bufferMin: number;
  minLeadHours: number;
  maxDaysAhead: number;
  travelCountsAgainstHours: boolean;
}

export interface AvailabilityInput {
  /** Inclusive local dates, YYYY-MM-DD. */
  fromDate: string;
  toDate: string;
  durationMin: number;
  /** Zone travel minutes for mobile jobs, 0 in-shop. */
  travelMin: number;
  resourceIds: string[];
  allocations: AllocationSpan[];
  hours: readonly BusinessHoursRow[];
  blackoutDates: readonly string[];
  settings: AvailabilitySettings;
  now: number;
  locale?: string;
}

export interface Slot {
  /** ISO-8601 UTC instant of the job start. */
  start: string;
  end: string;
  /** Wall-clock label in the business time zone, e.g. "9:30 AM". */
  label: string;
  /** Number of crews/bays still free for this slot. */
  capacity: number;
  freeResourceIds: string[];
}

export interface DayAvailability {
  date: string;
  slots: Slot[];
}

/** The resource time a job occupies: travel before, buffer after. */
export function blockedRange(startMs: number, durationMin: number, travelMin: number, bufferMin: number) {
  return {
    start: startMs - travelMin * MINUTE,
    end: startMs + (durationMin + bufferMin) * MINUTE,
  };
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** Allocations that still occupy time at `now` (expired holds are ignored immediately). */
export function liveAllocations(allocations: AllocationSpan[], now: number): AllocationSpan[] {
  return allocations.filter((a) => a.holdExpiresAt == null || a.holdExpiresAt > now);
}

export function computeAvailability(input: AvailabilityInput): DayAvailability[] {
  const { settings: s, now } = input;
  const tz = s.timezone;
  if (input.resourceIds.length === 0 || input.durationMin <= 0) return [];

  const byResource = new Map<string, AllocationSpan[]>();
  for (const id of input.resourceIds) byResource.set(id, []);
  for (const a of liveAllocations(input.allocations, now)) byResource.get(a.resourceId)?.push(a);

  const blackouts = new Set(input.blackoutDates);
  const earliest = now + s.minLeadHours * HOUR;
  const lastDate = todayIn(tz, now).add({ days: s.maxDaysAhead });

  const hoursByDay = new Map<number, BusinessHoursRow[]>();
  for (const h of input.hours) {
    const list = hoursByDay.get(h.weekday) ?? [];
    list.push(h);
    hoursByDay.set(h.weekday, list);
  }
  for (const list of hoursByDay.values()) list.sort((a, b) => a.opens.localeCompare(b.opens));

  const days: DayAvailability[] = [];
  let date = Temporal.PlainDate.from(input.fromDate);
  const to = Temporal.PlainDate.from(input.toDate);

  while (Temporal.PlainDate.compare(date, to) <= 0) {
    const dateStr = date.toString();
    const intervals = hoursByDay.get(date.dayOfWeek) ?? [];
    if (
      Temporal.PlainDate.compare(date, lastDate) <= 0 &&
      !blackouts.has(dateStr) &&
      intervals.length > 0
    ) {
      const slots: Slot[] = [];
      for (const iv of intervals) {
        const openMin = hhmmToMinutes(iv.opens);
        const closeMin = hhmmToMinutes(iv.closes);
        const openMs = wallTimeToEpochLenient(date, openMin, tz);
        const closeMs = wallTimeToEpochLenient(date, closeMin, tz);

        for (let m = openMin; m < closeMin; m += s.slotIntervalMin) {
          const start = wallTimeToEpoch(date, m, tz);
          if (start === null) continue; // nonexistent local time (spring-forward gap)
          const end = start + input.durationMin * MINUTE;
          if (start < earliest || end > closeMs) continue;
          if (s.travelCountsAgainstHours && start - input.travelMin * MINUTE < openMs) continue;

          const blocked = blockedRange(start, input.durationMin, input.travelMin, s.bufferMin);
          const free: string[] = [];
          for (const id of input.resourceIds) {
            const busy = (byResource.get(id) ?? []).some((a) =>
              overlaps(a.start, a.end, blocked.start, blocked.end),
            );
            if (!busy) free.push(id);
          }
          if (free.length === 0) continue;
          slots.push({
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            label: formatTime(start, tz, input.locale),
            capacity: free.length,
            freeResourceIds: free,
          });
        }
      }
      // De-duplicate identical instants (overlapping intervals or fall-back repeats).
      const seen = new Set<string>();
      const unique = slots.filter((sl) => (seen.has(sl.start) ? false : (seen.add(sl.start), true)));
      if (unique.length > 0) days.push({ date: dateStr, slots: unique });
    }
    date = date.add({ days: 1 });
  }
  return days;
}

/** Re-checks one exact start time with the same rules (used inside the hold transaction). */
export function freeResourcesAt(input: Omit<AvailabilityInput, "fromDate" | "toDate">, startIso: string) {
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return [];
  const localDate = Temporal.Instant.fromEpochMilliseconds(startMs)
    .toZonedDateTimeISO(input.settings.timezone)
    .toPlainDate()
    .toString();
  const days = computeAvailability({ ...input, fromDate: localDate, toDate: localDate });
  const slot = days[0]?.slots.find((sl) => Date.parse(sl.start) === startMs);
  return slot?.freeResourceIds ?? [];
}

/** The `n` slots closest in time to `targetIso` (used to offer alternatives on SLOT_TAKEN). */
export function nearestSlots(days: DayAvailability[], targetIso: string, n: number): Slot[] {
  const target = Date.parse(targetIso);
  return days
    .flatMap((d) => d.slots)
    .filter((s) => s.start !== targetIso)
    .sort((a, b) => Math.abs(Date.parse(a.start) - target) - Math.abs(Date.parse(b.start) - target))
    .slice(0, n)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
