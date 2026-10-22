import { eq } from "drizzle-orm";
import type { Queryable } from "@/db/client";
import * as s from "@/db/schema";
import { env } from "@/lib/env";
import { hashToken, looksLikeToken } from "../tokens";

export type QuoteRow = typeof s.quoteRequests.$inferSelect;

/** A quote that can be booked: status "quoted" and not expired. */
export async function loadBookableQuote(db: Queryable, token: string, now: Date) {
  const quote = await loadQuoteByToken(db, token);
  if (!quote) return { ok: false as const, reason: "invalid" as const };
  if (quote.status === "accepted") return { ok: false as const, reason: "accepted" as const, quote };
  if (quote.status !== "quoted") return { ok: false as const, reason: "invalid" as const };
  if (quote.quoteExpiresAt && quote.quoteExpiresAt.getTime() <= now.getTime())
    return { ok: false as const, reason: "expired" as const, quote };
  return { ok: true as const, quote };
}

export async function loadQuoteByToken(db: Queryable, token: string): Promise<QuoteRow | null> {
  if (!looksLikeToken(token)) return null;
  void env(); // ensure env is valid before touching tokens
  const [row] = await db
    .select()
    .from(s.quoteRequests)
    .where(eq(s.quoteRequests.quoteTokenHash, hashToken(token)));
  return row ?? null;
}
