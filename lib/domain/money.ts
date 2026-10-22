/** Integer-cent helpers. Money never touches floating point beyond a single rounded step. */

/** Round to the nearest multiple of `step` cents, half up (inputs are non-negative). */
export function roundToStep(cents: number, step: number): number {
  if (step <= 1) return Math.round(cents);
  return Math.round(cents / step) * step;
}

/** cents × multiplier, where the multiplier has at most 2 decimals (numeric(4,2)). */
export function applyMultiplier(cents: number, multiplier: number): number {
  const hundredths = Math.round(multiplier * 100);
  return Math.round((cents * hundredths) / 100);
}

/** Minutes × multiplier, always rounded up — a job never gets shorter by rounding. */
export function scaleMinutes(minutes: number, multiplier: number): number {
  const hundredths = Math.round(multiplier * 100);
  return Math.ceil((minutes * hundredths) / 100);
}

export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * Math.round(percent * 100)) / 10_000);
}

export function basisPointsOf(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

export function roundUpTo(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency = "USD", locale = "en-US"): string {
  const key = `${locale}:${currency}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, f);
  }
  const whole = cents % 100 === 0;
  return whole
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(cents / 100)
    : f.format(cents / 100);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hr" : `${h} hrs`;
  return `${h} hr ${m} min`;
}
