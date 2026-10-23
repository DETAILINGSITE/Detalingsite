/** Inspect captured notifications (NOTIFY_DRIVER=capture) and run background work on demand. */
import { and, asc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { cronTick, flushOutbox } from "@/lib/server/jobs";
import { notFound, testControlsEnabled } from "@/lib/server/test-mode";

export async function GET(request: Request) {
  if (!testControlsEnabled()) return notFound();
  const url = new URL(request.url);
  const conds: SQL[] = [];
  const bookingNumber = url.searchParams.get("booking");
  if (bookingNumber) {
    const [b] = await getDb().select({ id: s.bookings.id }).from(s.bookings).where(eq(s.bookings.number, bookingNumber));
    if (!b) return Response.json({ items: [] });
    conds.push(eq(s.outbox.bookingId, b.id));
  }
  const rows = await getDb()
    .select()
    .from(s.outbox)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(s.outbox.createdAt));
  return Response.json({
    items: rows.map((r) => ({
      type: r.type,
      status: r.status,
      dedupeKey: r.dedupeKey,
      runAt: r.runAt,
      template: (r.payload as { template?: string }).template ?? null,
      audience: (r.payload as { audience?: string }).audience ?? null,
      rendered: (r.payload as { rendered?: unknown }).rendered ?? null,
    })),
  });
}

export async function POST(request: Request) {
  if (!testControlsEnabled()) return notFound();
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (action === "cron") return Response.json(await cronTick());
  return Response.json(await flushOutbox(getDb(), { limit: 200 }));
}
