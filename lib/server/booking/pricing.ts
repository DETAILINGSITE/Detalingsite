import { and, eq, inArray, sql } from "drizzle-orm";
import type { Queryable } from "@/db/client";
import * as s from "@/db/schema";
import type { Promo } from "@/lib/domain/catalog";
import type { PricingContext, QuoteTerms } from "@/lib/domain/pricing";
import type { Zone } from "@/lib/domain/zones";
import { paymentsMode } from "@/lib/env";
import { engineCatalog, type BookingContext } from "./context";
import type { QuoteRow } from "./quotes-lookup";

export function pricingContext(
  ctx: BookingContext,
  opts: { zone?: Zone | null; promo?: Promo | null; quote?: QuoteTerms | null } = {},
): PricingContext {
  const noPayments = paymentsMode() === "none";
  return {
    catalog: engineCatalog(ctx),
    // Without a payment provider the deposit is collected at the appointment.
    deposit: noPayments ? { mode: "none" } : ctx.settings.deposit,
    taxRateBps: ctx.settings.taxRateBps,
    taxTravel: ctx.settings.taxTravel,
    priceRoundingCents: ctx.settings.priceRoundingCents,
    travelFeeCents: opts.zone?.travelFeeCents ?? 0,
    promo: opts.promo ?? null,
    quote: opts.quote ? { ...opts.quote, depositCents: noPayments ? 0 : opts.quote.depositCents } : null,
    maxJobMinutes: ctx.schedule.maxJobMinutes,
  };
}

export function quoteTermsFrom(q: QuoteRow): QuoteTerms {
  return {
    label: `Custom job (quote ${q.number})`,
    priceCents: q.quotedPriceCents ?? 0,
    durationMin: q.quotedDurationMin ?? 60,
    depositCents: q.quotedDepositCents,
  };
}

export type PromoCheck =
  | { ok: true; promo: Promo }
  | { ok: false; message: string };

export async function checkPromo(
  db: Queryable,
  code: string,
  now: Date,
  customerId: string | null,
): Promise<PromoCheck> {
  const [row] = await db.select().from(s.promoCodes).where(eq(s.promoCodes.code, code.trim()));
  const invalid = { ok: false as const, message: "That promo code isn't valid." };
  if (!row || !row.active) return invalid;
  if (row.startsAt && row.startsAt > now) return invalid;
  if (row.endsAt && row.endsAt <= now) return { ok: false, message: "That promo code has expired." };
  if (row.maxRedemptions != null && row.redemptionCount >= row.maxRedemptions)
    return { ok: false, message: "That promo code has been fully redeemed." };
  if (row.firstBookingOnly && customerId) {
    const [prior] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.bookings)
      .where(
        and(
          eq(s.bookings.customerId, customerId),
          inArray(s.bookings.status, ["confirmed", "in_progress", "completed", "no_show"]),
        ),
      );
    if ((prior?.n ?? 0) > 0) return { ok: false, message: "That code is for first-time customers only." };
  }
  return { ok: true, promo: { id: row.id, code: row.code, kind: row.kind, value: row.value } };
}

/** Atomically counts a redemption; false if the cap was reached in the meantime. */
export async function redeemPromo(db: Queryable, promoId: string): Promise<boolean> {
  const rows = await db
    .update(s.promoCodes)
    .set({ redemptionCount: sql`${s.promoCodes.redemptionCount} + 1` })
    .where(
      and(
        eq(s.promoCodes.id, promoId),
        sql`(${s.promoCodes.maxRedemptions} IS NULL OR ${s.promoCodes.redemptionCount} < ${s.promoCodes.maxRedemptions})`,
      ),
    )
    .returning({ id: s.promoCodes.id });
  return rows.length > 0;
}
