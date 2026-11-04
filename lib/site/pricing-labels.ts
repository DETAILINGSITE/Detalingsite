import { formatMoney } from "@/lib/domain/money";

/** Add-ons the price flyer lists as "starting at": the final price depends on the vehicle and the job. */
const STARTING_AT = new Set(["ceramic-coating", "pet-hair-removal", "excessive-mud-sand"]);

/** Short names for the vehicle sizes, as the price flyer says them. Unknown sizes use their own label. */
const SHORT_SIZE: Record<string, string> = { sedan: "Cars", suv: "Trucks & SUVs" };
export const shortSizeLabel = (sizeId: string, fallback = sizeId) => SHORT_SIZE[sizeId] ?? fallback;

/**
 * The price as customers should read it, e.g. "$75" or "from $30". Package prices are flat per
 * vehicle size (the owner confirmed VIP trucks & SUVs are $550, not "$550+").
 */
export function priceLabel(slug: string, _sizeId: string, cents: number): string {
  const base = formatMoney(cents);
  return STARTING_AT.has(slug) ? `from ${base}` : base;
}

/**
 * One label for an item across every vehicle size, matching the pricing table. A flat price reads
 * "$45" (or "From $30" for "starting at" add-ons); a price that depends on the vehicle spells out
 * each size: "Cars $75 · Trucks & SUVs $95".
 */
export function itemPriceLabel(slug: string, bySize: Record<string, { priceCents: number }>, opts: { capitalize?: boolean } = {}): string {
  const entries = Object.entries(bySize);
  const first = entries[0];
  if (!first) return "";
  const flat = entries.every(([, v]) => v.priceCents === first[1].priceCents);
  const label = flat
    ? priceLabel(slug, first[0], first[1].priceCents)
    : entries.map(([id, v]) => `${shortSizeLabel(id)} ${priceLabel(slug, id, v.priceCents)}`).join(" · ");
  return opts.capitalize ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}
