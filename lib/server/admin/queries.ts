/** Admin read models. Every caller is already authorized (requireAdminPage / requireAdmin). */
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Queryable } from "@/db/client";
import * as s from "@/db/schema";
import { FUNNEL_STEPS } from "../funnel";

export interface Range {
  from: Date;
  to: Date;
}

export async function metrics(range: Range, db: Queryable = getDb()) {
  const inRange = and(gte(s.bookings.startsAt, range.from), lt(s.bookings.startsAt, range.to));
  const live = inArray(s.bookings.status, ["confirmed", "in_progress", "completed"]);
  const [bookingsAgg] = await db
    .select({ n: count(), booked: sql<number>`coalesce(sum(${s.bookings.totalCents}),0)::int` })
    .from(s.bookings)
    .where(and(inRange, live));
  const [created] = await db
    .select({ n: count() })
    .from(s.bookings)
    .where(and(gte(s.bookings.createdAt, range.from), lt(s.bookings.createdAt, range.to), isNotNull(s.bookings.confirmedAt)));
  const [collected] = await db
    .select({
      cents: sql<number>`coalesce(sum(case when ${s.payments.kind} = 'refund' then -${s.payments.amountCents} else ${s.payments.amountCents} end),0)::int`,
    })
    .from(s.payments)
    .where(
      and(
        gte(s.payments.createdAt, range.from),
        lt(s.payments.createdAt, range.to),
        inArray(s.payments.status, ["succeeded", "refunded"]),
      ),
    );
  const byStatus = await db
    .select({ status: s.bookings.status, n: count() })
    .from(s.bookings)
    .where(inRange)
    .groupBy(s.bookings.status);

  // Funnel: distinct sessions that viewed each step.
  const funnelRows = await db
    .select({ step: s.funnelEvents.step, sessions: sql<number>`count(distinct ${s.funnelEvents.sessionId})::int` })
    .from(s.funnelEvents)
    .where(and(eq(s.funnelEvents.event, "step_view"), gte(s.funnelEvents.at, range.from), lt(s.funnelEvents.at, range.to)))
    .groupBy(s.funnelEvents.step);
  const funnel = FUNNEL_STEPS.filter((st) => st !== "custom")
    .map((step) => ({ step, sessions: funnelRows.find((r) => r.step === step)?.sessions ?? 0 }))
    .filter((r) => r.step !== "confirmation");
  // Paid bookings confirm via webhook (no browser session), so count confirmed bookings.
  funnel.push({ step: "confirmation", sessions: created?.n ?? 0 });

  const sources = await db.execute<{ source: string; leads: number; bookings: number }>(sql`
    WITH l AS (
      SELECT coalesce(nullif(attribution->>'utmSource',''), CASE WHEN attribution->>'referrer' IS NOT NULL THEN 'referral' ELSE 'direct' END) AS source, count(*)::int AS n
      FROM leads WHERE created_at >= ${range.from.toISOString()}::timestamptz AND created_at < ${range.to.toISOString()}::timestamptz GROUP BY 1
    ), b AS (
      SELECT coalesce(nullif(attribution->>'utmSource',''), nullif(heard_about,''), CASE WHEN attribution->>'referrer' IS NOT NULL THEN 'referral' ELSE 'direct' END) AS source, count(*)::int AS n
      FROM bookings WHERE confirmed_at >= ${range.from.toISOString()}::timestamptz AND confirmed_at < ${range.to.toISOString()}::timestamptz GROUP BY 1
    )
    SELECT coalesce(l.source, b.source) AS source, coalesce(l.n,0) AS leads, coalesce(b.n,0) AS bookings
    FROM l FULL OUTER JOIN b ON l.source = b.source ORDER BY 3 DESC, 2 DESC LIMIT 12`);

  return {
    bookings: bookingsAgg?.n ?? 0,
    bookedCents: bookingsAgg?.booked ?? 0,
    newBookings: created?.n ?? 0,
    collectedCents: collected?.cents ?? 0,
    byStatus,
    funnel,
    sources: sources.rows,
  };
}

export async function health(db: Queryable = getDb()) {
  const [lastCron] = await db.select().from(s.cronRuns).orderBy(desc(s.cronRuns.startedAt)).limit(1);
  const [failed] = await db.select({ n: count() }).from(s.outbox).where(eq(s.outbox.status, "failed"));
  const [webhookErrors] = await db.select({ n: count() }).from(s.webhookEvents).where(and(isNotNull(s.webhookEvents.error), sql`${s.webhookEvents.processedAt} IS NULL`));
  const recentFailures = await db.select().from(s.outbox).where(eq(s.outbox.status, "failed")).orderBy(desc(s.outbox.createdAt)).limit(5);
  return { lastCron: lastCron ?? null, failedOutbox: failed?.n ?? 0, webhookErrors: webhookErrors?.n ?? 0, recentFailures };
}

export interface BookingFilters {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
}

export async function listBookings(f: BookingFilters, db: Queryable = getDb()) {
  const conds: SQL[] = [];
  if (f.status && f.status !== "all") conds.push(eq(s.bookings.status, f.status as (typeof s.bookingStatus.enumValues)[number]));
  else conds.push(inArray(s.bookings.status, ["pending_payment", "confirmed", "in_progress", "completed", "cancelled", "no_show"]));
  if (f.from) conds.push(gte(s.bookings.startsAt, new Date(`${f.from}T00:00:00Z`)));
  if (f.to) conds.push(lt(s.bookings.startsAt, new Date(`${f.to}T23:59:59Z`)));
  if (f.q) {
    const q = `%${f.q.trim()}%`;
    conds.push(or(ilike(s.bookings.number, q), ilike(s.customers.name, q), ilike(s.customers.email, q), ilike(s.customers.phoneE164, q))!);
  }
  const page = Math.max(1, f.page ?? 1);
  const rows = await db
    .select({ b: s.bookings, c: { name: s.customers.name, email: s.customers.email, phone: s.customers.phoneE164 } })
    .from(s.bookings)
    .leftJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(and(...conds))
    .orderBy(desc(s.bookings.startsAt))
    .limit(50)
    .offset((page - 1) * 50);
  return rows;
}

export async function bookingDetail(id: string, db: Queryable = getDb()) {
  const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!b) return null;
  const [customer] = b.customerId ? await db.select().from(s.customers).where(eq(s.customers.id, b.customerId)) : [];
  const [events, payments, alloc, messages] = await Promise.all([
    db.select().from(s.bookingEvents).where(eq(s.bookingEvents.bookingId, id)).orderBy(desc(s.bookingEvents.createdAt)),
    db.select().from(s.payments).where(eq(s.payments.bookingId, id)).orderBy(asc(s.payments.createdAt)),
    db.select({ a: s.resourceAllocations, r: s.resources }).from(s.resourceAllocations).innerJoin(s.resources, eq(s.resources.id, s.resourceAllocations.resourceId)).where(and(eq(s.resourceAllocations.bookingId, id), eq(s.resourceAllocations.active, true))),
    db.select().from(s.outbox).where(eq(s.outbox.bookingId, id)).orderBy(desc(s.outbox.createdAt)).limit(30),
  ]);
  return { booking: b, customer: customer ?? null, events, payments, resource: alloc[0]?.r ?? null, messages };
}

export async function calendarItems(range: Range, db: Queryable = getDb()) {
  return db
    .select({
      allocationId: s.resourceAllocations.id,
      resourceId: s.resourceAllocations.resourceId,
      kind: s.resourceAllocations.kind,
      period: s.resourceAllocations.period,
      note: s.resourceAllocations.note,
      holdExpiresAt: s.resourceAllocations.holdExpiresAt,
      bookingId: s.bookings.id,
      number: s.bookings.number,
      status: s.bookings.status,
      startsAt: s.bookings.startsAt,
      endsAt: s.bookings.endsAt,
      customerName: s.customers.name,
      locationType: s.bookings.locationType,
    })
    .from(s.resourceAllocations)
    .leftJoin(s.bookings, eq(s.bookings.id, s.resourceAllocations.bookingId))
    .leftJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(
      and(
        eq(s.resourceAllocations.active, true),
        sql`${s.resourceAllocations.period} && tstzrange(${range.from.toISOString()}::timestamptz, ${range.to.toISOString()}::timestamptz, '[)')`,
      ),
    );
}
