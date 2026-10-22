import type { Queryable } from "@/db/client";
import * as s from "@/db/schema";

export const FUNNEL_STEPS = ["path", "vehicle", "services", "custom", "location", "schedule", "contact", "review", "confirmation"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
export const FUNNEL_EVENTS = ["step_view", "step_complete", "hold_created", "payment_started", "confirmed", "abandoned", "quote_submitted"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Anonymous funnel analytics (no PII) — powers "conversion by step" in admin. */
export async function recordFunnel(
  db: Queryable,
  e: { sessionId: string; event: FunnelEvent; step?: string | null; bookingId?: string | null; at: Date; utmSource?: string | null },
) {
  try {
    await db.insert(s.funnelEvents).values({
      sessionId: e.sessionId,
      event: e.event,
      step: e.step ?? null,
      bookingId: e.bookingId ?? null,
      utmSource: e.utmSource ?? null,
      at: e.at,
    });
  } catch (err) {
    // Analytics must never break a booking.
    console.warn("[funnel] failed to record", err instanceof Error ? err.message : err);
  }
}
