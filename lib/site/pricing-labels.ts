import { formatMoney } from "@/lib/domain/money";

/** Add-ons the price flyer lists as "starting at": the final price depends on the vehicle and the job. */
const STARTING_AT = new Set(["ceramic-coating", "pet-hair-removal", "excessive-mud-sand"]);

/** Items the flyer prices as "$X+" for trucks and SUVs (the final price depends on size and condition). */
const PLUS_FOR_LARGE = new Set(["vip", "vip-showroom-finish"]);

/** The price as customers should read it, e.g. "$75", "from $30" or "$550+". */
export function priceLabel(slug: string, sizeId: string, cents: number): string {
  const base = formatMoney(cents);
  if (STARTING_AT.has(slug)) return `from ${base}`;
  if (PLUS_FOR_LARGE.has(slug) && sizeId !== "sedan") return `${base}+`;
  return base;
}
