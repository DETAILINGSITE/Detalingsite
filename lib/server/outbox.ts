/**
 * Transactional outbox (docs/PLAN.md §5.5). Side effects are enqueued inside the same
 * DB transaction as the state change, then executed after commit (via `after()`)
 * and by the cron backstop. Dedupe keys make enqueueing idempotent.
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";
import type { Db, Queryable } from "@/db/client";
import * as s from "@/db/schema";

export type OutboxType =
  | "email"
  | "sms"
  | "stripe.expire_session"
  | "stripe.refund"
  | "gcal.upsert"
  | "gcal.delete";

export interface EnqueueArgs {
  type: OutboxType;
  payload: Record<string, unknown>;
  runAt: Date;
  dedupeKey: string;
  bookingId?: string | null;
  leadId?: string | null;
  quoteRequestId?: string | null;
  maxAttempts?: number;
}

export async function enqueue(db: Queryable, args: EnqueueArgs) {
  const rows = await db
    .insert(s.outbox)
    .values({
      type: args.type,
      payload: args.payload,
      runAt: args.runAt,
      dedupeKey: args.dedupeKey,
      bookingId: args.bookingId ?? null,
      leadId: args.leadId ?? null,
      quoteRequestId: args.quoteRequestId ?? null,
      maxAttempts: args.maxAttempts ?? 6,
    })
    .onConflictDoNothing({ target: s.outbox.dedupeKey })
    .returning({ id: s.outbox.id });
  return rows[0]?.id ?? null;
}

/** Cancel pending rows for a booking whose dedupe key starts with `prefix`. */
export async function cancelPending(db: Queryable, bookingId: string, prefix: string) {
  await db
    .update(s.outbox)
    .set({ status: "cancelled", doneAt: sql`now()` })
    .where(
      and(
        eq(s.outbox.bookingId, bookingId),
        eq(s.outbox.status, "pending"),
        like(s.outbox.dedupeKey, `${prefix}%`),
      ),
    );
}

export type OutboxRow = typeof s.outbox.$inferSelect;
export type HandlerResult = { status: "done" | "skipped"; providerId?: string | null; payloadPatch?: Record<string, unknown> };
export type OutboxHandler = (row: OutboxRow, db: Db) => Promise<HandlerResult>;

const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

export function backoffFor(attempts: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempts - 1, 0), BACKOFF_MS.length - 1)] ?? 60_000;
}

/** Claim up to `limit` due rows (SKIP LOCKED: concurrent workers never double-send). */
export async function claimDue(db: Db, now: Date, limit = 25, ids?: string[]): Promise<OutboxRow[]> {
  const lockUntil = new Date(now.getTime() + 5 * 60_000);
  const idFilter = ids?.length ? sql`AND ${inArray(s.outbox.id, ids)}` : sql``;
  const result = await db.execute<Record<string, unknown>>(sql`
    UPDATE outbox SET status = 'running', locked_until = ${lockUntil.toISOString()}::timestamptz, attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM outbox
      WHERE status = 'pending' AND run_at <= ${now.toISOString()}::timestamptz ${idFilter}
      ORDER BY run_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`);
  const claimed = result.rows.map((r) => String(r.id));
  if (claimed.length === 0) return [];
  return db.select().from(s.outbox).where(inArray(s.outbox.id, claimed));
}

/** Rows stuck in "running" past their lock (crashed worker) go back to pending. */
export async function releaseStuck(db: Db, now: Date) {
  await db.execute(sql`
    UPDATE outbox SET status = 'pending', locked_until = NULL
    WHERE status = 'running' AND locked_until < ${now.toISOString()}::timestamptz`);
}

export async function processOutbox(
  db: Db,
  handlers: Partial<Record<OutboxType, OutboxHandler>>,
  now: Date,
  opts: { limit?: number; ids?: string[] } = {},
) {
  const rows = await claimDue(db, now, opts.limit ?? 25, opts.ids);
  let processed = 0;
  for (const row of rows) {
    const handler = handlers[row.type as OutboxType];
    try {
      if (!handler) throw new Error(`No handler for outbox type ${row.type}`);
      const res = await handler(row, db);
      await db
        .update(s.outbox)
        .set({
          status: res.status,
          doneAt: now,
          lockedUntil: null,
          lastError: null,
          providerId: res.providerId ?? null,
          ...(res.payloadPatch ? { payload: { ...row.payload, ...res.payloadPatch } } : {}),
        })
        .where(eq(s.outbox.id, row.id));
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = row.attempts >= row.maxAttempts;
      await db
        .update(s.outbox)
        .set({
          status: failed ? "failed" : "pending",
          lockedUntil: null,
          lastError: message.slice(0, 2000),
          runAt: failed ? row.runAt : new Date(now.getTime() + backoffFor(row.attempts)),
        })
        .where(eq(s.outbox.id, row.id));
      console.error(`[outbox] ${row.type} ${row.id} attempt ${row.attempts} failed: ${message}`);
    }
  }
  return { claimed: rows.length, processed };
}
