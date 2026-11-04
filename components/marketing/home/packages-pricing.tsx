import { Check } from "lucide-react";
import Link from "next/link";
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

/** Tiered packages. Every card shows the price for each vehicle size side by side, like the price flyer. */
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
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {packages.map((p) => {
          const tier = tierColor(p.slug);
          const firstEntry = firstSize ? p.bySize[firstSize] : undefined;
          return (
            <li
              key={p.id}
              data-reveal
              className={cn("card relative flex flex-col gap-6 overflow-hidden p-7", p.featured && "lg:-translate-y-3")}
              style={{
                borderColor: `color-mix(in srgb, ${tier} ${p.featured ? 70 : 40}%, transparent)`,
                boxShadow: p.featured ? `0 30px 80px -40px ${tier}` : undefined,
              }}
            >
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: tier }} />
              {p.featured && (
                <span
                  className="absolute top-4 right-5 rounded-full px-3 py-1 text-xs font-bold tracking-wide text-ink-950 uppercase"
                  style={{ background: tier }}
                >
                  Most popular
                </span>
              )}
              <div>
                <h3 className="text-2xl font-bold" style={{ color: tier }}>
                  {p.name}
                </h3>
                <p className="mt-1 text-sm text-fg-muted">{p.tagline}</p>
              </div>
              {/* Side by side on phones and tablets; stacked rows once four narrow cards share a line. */}
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-2">
                {sizes.map((z) => {
                  const entry = p.bySize[z.id];
                  return (
                    <div key={z.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5 lg:flex lg:items-center lg:justify-between lg:gap-3">
                      <dt className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{shortSizeLabel(z.id, z.label)}</dt>
                      <dd className="tabular mt-1 font-display text-3xl font-bold lg:mt-0 lg:text-2xl">{entry ? priceLabel(p.slug, z.id, entry.priceCents) : "—"}</dd>
                    </div>
                  );
                })}
              </dl>
              <p className="-mt-3 text-sm text-fg-subtle">About {firstEntry ? formatDuration(firstEntry.durationMin) : "—"}</p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {p.includedNames.map((n) => (
                  <li key={n} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0" style={{ color: tier }} aria-hidden="true" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/book?pkg=${p.slug}`}
                className={cn(buttonVariants({ variant: p.featured ? "primary" : "secondary" }), "mt-auto")}
                style={
                  p.featured
                    ? { background: tier, borderColor: tier, color: "#0b0c0e", boxShadow: "none" }
                    : { borderColor: `color-mix(in srgb, ${tier} 60%, transparent)`, color: tier }
                }
              >
                Book {p.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
