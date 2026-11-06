import Link from "next/link";
import type { CSSProperties } from "react";
import { buttonVariants } from "@/components/ui/button";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { formatDuration } from "@/lib/domain/money";
import { priceLabel, shortSizeLabel } from "@/lib/site/pricing-labels";
import { clsx as cn } from "clsx";

/** Each tier has its own accent, matching the price flyer. Unknown packages fall back to the brand colour. */
const TIER_COLOR: Record<string, string> = {
  bronze: "#e0a060",
  silver: "#d5dae2",
  gold: "#e6c056",
  vip: "#b58cff",
};
const tierColor = (slug: string) => TIER_COLOR[slug] ?? "var(--brand)";

export interface PackageCardData {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  featured: boolean;
  isPlaceholder: boolean;
  includedNames: string[];
  bySize: Record<string, { priceCents: number; durationMin: number }>;
}

/**
 * Tiered packages. Every card shows the price for each vehicle size side by side, like the price flyer.
 * The tier colour is one CSS variable; the accent bar, glow, borders and check marks come from the
 * .tier-* classes in globals.css. This is the heaviest block on the home page, and every element and
 * inline style here is hydrated on a phone's first load, so keep it lean.
 */
export function PackagesPricing({ packages, sizes }: { packages: PackageCardData[]; sizes: { id: string; label: string }[] }) {
  const anyPlaceholder = packages.some((p) => p.isPlaceholder);
  const firstSize = sizes[0]?.id;

  return (
    <div>
      {anyPlaceholder && (
        <p className="text-center">
          <PlaceholderBadge label="Sample prices — set real prices in admin" />
        </p>
      )}
      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-fan>
        {packages.map((p) => {
          const firstEntry = firstSize ? p.bySize[firstSize] : undefined;
          return (
            <li
              key={p.id}
              data-fan-item
              data-tilt="5"
              data-featured={p.featured || undefined}
              className="card glint tier-card"
              style={{ "--tier": tierColor(p.slug) } as CSSProperties}
            >
              <span className="spot" aria-hidden="true" />
              <div>
                {/* Badge sits in the title row and wraps under it on narrow cards, so it never covers the name. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="text-2xl font-bold text-(--tier)">{p.name}</h3>
                  {p.featured && <span className="tier-badge">Most popular</span>}
                </div>
                <p className="mt-1 text-sm text-fg-muted">{p.tagline}</p>
              </div>
              {/* Side by side on phones and tablets; stacked rows once four narrow cards share a line. */}
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-2">
                {sizes.map((z) => {
                  const entry = p.bySize[z.id];
                  return (
                    <div key={z.id} className="tier-price">
                      <dt>{shortSizeLabel(z.id, z.label)}</dt>
                      <dd className="tabular font-display">{entry ? priceLabel(p.slug, z.id, entry.priceCents) : "—"}</dd>
                    </div>
                  );
                })}
              </dl>
              <p className="-mt-3 text-sm text-fg-subtle">About {firstEntry ? formatDuration(firstEntry.durationMin) : "—"}</p>
              <ul className="tier-checks">
                {p.includedNames.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <Link href={`/book?pkg=${p.slug}`} className={cn(buttonVariants({ variant: p.featured ? "primary" : "secondary" }), "tier-btn mt-auto")}>
                Book {p.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
