/**
 * Time-zone utilities. All wall-clock ↔ instant conversion goes through Temporal so
 * DST is handled with explicit disambiguation (docs/PLAN.md §5.2). Never do
 * "+24h in UTC" arithmetic for local dates.
 */
import { Temporal } from "temporal-polyfill";

export { Temporal };

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Today's date in `tz` as YYYY-MM-DD. */
export function todayIn(tz: string, nowMs: number): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(nowMs).toZonedDateTimeISO(tz).toPlainDate();
}

export function minutesToPlainTime(minutes: number): Temporal.PlainTime {
  return new Temporal.PlainTime(Math.floor(minutes / 60), minutes % 60);
}

/**
 * Converts a local wall-clock time on `date` in `tz` to an epoch-ms instant.
 * Returns null when the wall time does not exist (spring-forward gap).
 * For a repeated wall time (fall-back overlap) the EARLIER instant is returned.
 */
export function wallTimeToEpoch(
  date: Temporal.PlainDate,
  minutesSinceMidnight: number,
  tz: string,
): number | null {
  const pdt = date.toPlainDateTime(minutesToPlainTime(minutesSinceMidnight));
  const zdt = pdt.toZonedDateTime(tz, { disambiguation: "compatible" });
  if (!zdt.toPlainDateTime().equals(pdt)) return null; // shifted ⇒ was inside a gap
  return zdt.epochMilliseconds;
}

/** Like wallTimeToEpoch but never null: gap times resolve to the instant after the gap. */
export function wallTimeToEpochLenient(
  date: Temporal.PlainDate,
  minutesSinceMidnight: number,
  tz: string,
): number {
  const pdt = date.toPlainDateTime(minutesToPlainTime(minutesSinceMidnight));
  return pdt.toZonedDateTime(tz, { disambiguation: "compatible" }).epochMilliseconds;
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatTime(epochMs: number, tz: string, locale = "en-US"): string {
  const key = `${locale}|${tz}`;
  let f = timeFormatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "numeric", minute: "2-digit" });
    timeFormatters.set(key, f);
  }
  return f.format(epochMs);
}

export function formatDateLong(epochMs: number, tz: string, locale = "en-US"): string {
  const key = `${locale}|${tz}`;
  let f = dateFormatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    dateFormatters.set(key, f);
  }
  return f.format(epochMs);
}

export function formatDateTimeLong(epochMs: number, tz: string, locale = "en-US"): string {
  return `${formatDateLong(epochMs, tz, locale)} at ${formatTime(epochMs, tz, locale)}`;
}

/** Short zone label for display, e.g. "CDT". */
export function zoneAbbreviation(epochMs: number, tz: string, locale = "en-US"): string {
  const parts = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "short" }).formatToParts(
    epochMs,
  );
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/** Local date (YYYY-MM-DD) of an instant in `tz`. */
export function localDateOf(epochMs: number, tz: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(tz).toPlainDate().toString();
}

/** Local minutes-since-midnight of an instant in `tz`. */
export function localMinutesOf(epochMs: number, tz: string): number {
  const z = Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(tz);
  return z.hour * 60 + z.minute;
}
