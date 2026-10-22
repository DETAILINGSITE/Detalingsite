/**
 * Reminder timing (docs/PLAN.md §5.5). Pure functions — the server enqueues the results.
 */
import { hhmmToMinutes } from "./settings";
import { HOUR, MINUTE, localDateOf, localMinutesOf, Temporal, wallTimeToEpochLenient } from "./time";

export interface ReminderPlan {
  hoursBefore: number;
  emailAt: number;
  /** null → SMS skipped for this reminder (would land in quiet hours too close to the start). */
  smsAt: number | null;
}

export function inQuietHours(epochMs: number, tz: string, quietStart: string, quietEnd: string): boolean {
  const m = localMinutesOf(epochMs, tz);
  const start = hhmmToMinutes(quietStart);
  const end = hhmmToMinutes(quietEnd);
  return start > end ? m >= start || m < end : m >= start && m < end;
}

/** The end of the quiet period containing `epochMs` (same or next local day). */
export function quietHoursEnd(epochMs: number, tz: string, quietEnd: string): number {
  const endMin = hhmmToMinutes(quietEnd);
  const date = Temporal.PlainDate.from(localDateOf(epochMs, tz));
  const sameDay = wallTimeToEpochLenient(date, endMin, tz);
  return sameDay > epochMs ? sameDay : wallTimeToEpochLenient(date.add({ days: 1 }), endMin, tz);
}

export function planReminders(input: {
  startsAt: number;
  now: number;
  hoursBefore: number[];
  tz: string;
  quietStart: string;
  quietEnd: string;
}): ReminderPlan[] {
  const plans: ReminderPlan[] = [];
  for (const h of [...input.hoursBefore].sort((a, b) => b - a)) {
    const at = input.startsAt - h * HOUR;
    if (at <= input.now) continue; // booked too late for this reminder
    let smsAt: number | null = at;
    if (inQuietHours(at, input.tz, input.quietStart, input.quietEnd)) {
      const moved = quietHoursEnd(at, input.tz, input.quietEnd);
      smsAt = moved <= input.startsAt - 30 * MINUTE ? moved : null;
    }
    plans.push({ hoursBefore: h, emailAt: at, smsAt });
  }
  return plans;
}
