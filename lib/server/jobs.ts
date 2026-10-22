/**
 * Background work. `/api/cron/tick` calls cronTick() every 5 minutes (Vercel Cron or the
 * Docker scheduler). Correctness never depends on it: expired holds are ignored by
 * availability immediately, and side effects are also flushed right after each request.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import * as s from "@/db/schema";
import { sweepExpiredHolds } from "./booking/holds";
import { loadSettings } from "./data/settings";
import { now as clockNow } from "./clock";
import { outboxHandlers } from "./notify/handlers";
import { processOutbox, releaseStuck } from "./outbox";
import { pruneRateLimits } from "./rate-limit";

export async function flushOutbox(db: Db = getDb(), opts: { ids?: string[]; limit?: number } = {}) {
  return processOutbox(db, outboxHandlers, new Date(clockNow()), opts);
}

export async function cronTick(db: Db = getDb()) {
  const started = new Date(clockNow());
  const [run] = await db.insert(s.cronRuns).values({ startedAt: started }).returning({ id: s.cronRuns.id });
  let processed = 0;
  try {
    const now = new Date(clockNow());
    const expired = await db.transaction((tx) => sweepExpiredHolds(tx, now));
    await releaseStuck(db, now);

    // Quotes past their expiry.
    await db
      .update(s.quoteRequests)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(s.quoteRequests.status, "quoted"), lt(s.quoteRequests.quoteExpiresAt, now)));

    for (let i = 0; i < 8; i++) {
      const r = await flushOutbox(db, { limit: 50 });
      processed += r.processed;
      if (r.claimed < 50) break;
    }

    await pruneRateLimits(db, now.getTime());

    // Lead retention (privacy): purge unconverted abandoned-booking leads after N months.
    const settings = await loadSettings(db);
    await db.execute(sql`
      DELETE FROM leads
      WHERE source = 'booking_abandoned' AND status IN ('new', 'lost')
        AND created_at < ${new Date(now.getTime() - settings.leadRetentionMonths * 30 * 86_400_000).toISOString()}::timestamptz`);

    if (run) await db.update(s.cronRuns).set({ finishedAt: new Date(clockNow()), processed }).where(eq(s.cronRuns.id, run.id));
    return { expiredHolds: expired.length, processed };
  } catch (err) {
    if (run)
      await db
        .update(s.cronRuns)
        .set({ finishedAt: new Date(clockNow()), processed, error: (err as Error).message.slice(0, 1000) })
        .where(eq(s.cronRuns.id, run.id));
    throw err;
  }
}
