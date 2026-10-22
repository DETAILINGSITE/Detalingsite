/**
 * Fixed-window rate limiter on Postgres (no Redis dependency). One UPSERT per check.
 */
import { sql } from "drizzle-orm";
import type { Queryable } from "@/db/client";

export const LIMITS = {
  availability: { limit: 60, windowSec: 60 },
  hold: { limit: 10, windowSec: 600 },
  form: { limit: 5, windowSec: 3600 },
  contactStep: { limit: 10, windowSec: 600 },
  payment: { limit: 10, windowSec: 600 },
  uploadSign: { limit: 30, windowSec: 3600 },
  manage: { limit: 10, windowSec: 3600 },
  places: { limit: 120, windowSec: 600 },
  events: { limit: 120, windowSec: 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

export function windowStart(nowMs: number, windowSec: number): Date {
  const w = windowSec * 1000;
  return new Date(Math.floor(nowMs / w) * w);
}

export async function rateLimit(
  db: Queryable,
  name: LimitName,
  subject: string,
  nowMs: number,
): Promise<{ ok: boolean; retryAfterSec: number; count: number }> {
  const { limit, windowSec } = LIMITS[name];
  const start = windowStart(nowMs, windowSec);
  const key = `${name}:${subject}`;
  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${start.toISOString()}::timestamptz, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`);
  const count = Number(result.rows[0]?.count ?? 1);
  const retryAfterSec = Math.ceil((start.getTime() + windowSec * 1000 - nowMs) / 1000);
  return { ok: count <= limit, retryAfterSec, count };
}

export async function pruneRateLimits(db: Queryable, nowMs: number) {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < ${new Date(nowMs - 24 * 3600_000).toISOString()}::timestamptz`);
}
