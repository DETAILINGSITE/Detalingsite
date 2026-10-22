/**
 * The application clock. Business logic never calls Date.now() or SQL now() directly;
 * it uses `now()` so tests can move time (hold expiry, reminders, DST days) with
 * TEST_CLOCK=1. The offset lives on globalThis so every server bundle shares it.
 */
const g = globalThis as unknown as { __detailingClockOffsetMs?: number };

export function now(): number {
  return Date.now() + (process.env.TEST_CLOCK === "1" ? (g.__detailingClockOffsetMs ?? 0) : 0);
}

export function nowDate(): Date {
  return new Date(now());
}

export function setClockOffset(ms: number) {
  if (process.env.TEST_CLOCK !== "1") throw new Error("Test clock is disabled");
  g.__detailingClockOffsetMs = ms;
}

/** Set the clock so that now() returns `epochMs`. */
export function setClockTo(epochMs: number) {
  setClockOffset(epochMs - Date.now());
}

export function getClockOffset(): number {
  return g.__detailingClockOffsetMs ?? 0;
}
