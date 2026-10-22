/**
 * The ONLY writer of bookings.status. Each transition is a conditional UPDATE
 * guarded by the allowed "from" statuses, plus a booking_events row, in the
 * caller's transaction. Returns null when the booking wasn't in an allowed state
 * (e.g. a duplicate webhook) so callers can treat it as a no-op.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { Queryable } from "@/db/client";
import * as s from "@/db/schema";
import { BOOKING_TRANSITIONS, type BookingEvent } from "@/lib/domain/booking-state";

export type Actor = "customer" | "admin" | "system" | "stripe";

export async function transition(
  db: Queryable,
  args: {
    bookingId: string;
    event: BookingEvent;
    actor: Actor;
    actorId?: string | null;
    at: Date;
    data?: Record<string, unknown>;
    set?: Partial<typeof s.bookings.$inferInsert>;
  },
) {
  const t = BOOKING_TRANSITIONS[args.event];
  const [before] = await db
    .select({ status: s.bookings.status })
    .from(s.bookings)
    .where(eq(s.bookings.id, args.bookingId));
  if (!before) return null;

  const [row] = await db
    .update(s.bookings)
    .set({ ...args.set, status: t.to, updatedAt: args.at })
    .where(and(eq(s.bookings.id, args.bookingId), inArray(s.bookings.status, [...t.from])))
    .returning();
  if (!row) return null;

  await db.insert(s.bookingEvents).values({
    bookingId: args.bookingId,
    type: args.event,
    fromStatus: before.status,
    toStatus: t.to,
    actor: args.actor,
    actorId: args.actorId ?? null,
    data: args.data ?? {},
    createdAt: args.at,
  });
  return row;
}

export async function recordEvent(
  db: Queryable,
  args: { bookingId: string; type: string; actor: Actor; actorId?: string | null; at: Date; data?: Record<string, unknown> },
) {
  await db.insert(s.bookingEvents).values({
    bookingId: args.bookingId,
    type: args.type,
    actor: args.actor,
    actorId: args.actorId ?? null,
    data: args.data ?? {},
    createdAt: args.at,
  });
}
