"use client";
import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { formatDuration } from "@/lib/domain/money";
import { priceLabel } from "@/lib/site/pricing-labels";
// clsx, not cn(): no conflicting utilities here, and it keeps tailwind-merge off the client.
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

/** Tiered packages with a live vehicle-size toggle (prices come from the cached catalog). */
export function PackagesPricing({ packages, sizes }: { packages: PackageCardData[]; sizes: { id: string; label: string }[] }) {
  const [size, setSize] = useState(sizes[0]?.id ?? "sedan");
  const anyPlaceholder = packages.some((p) => p.isPlaceholder);

  return (
    <div>
      <fieldset className="mx-auto grid w-full max-w-sm grid-cols-2 gap-1 rounded-3xl border border-white/10 bg-ink-850 p-1 sm:flex sm:w-fit sm:max-w-none sm:flex-wrap sm:justify-center sm:rounded-full">
        <legend className="sr-only">Vehicle size</legend>
        {sizes.map((z) => (
          <label
            key={z.id}
            className={cn(
              "relative inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 text-center text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-300",
              size === z.id ? "bg-[var(--brand)] text-ink-950" : "text-fg-muted hover:text-fg",
            )}
          >
            <input type="radio" name="pkg-size" value={z.id} checked={size === z.id} onChange={() => setSize(z.id)} className="sr-only" />
            {z.label}
          </label>
        ))}
      </fieldset>
      {anyPlaceholder && (
        <p className="mt-4 text-center">
          <PlaceholderBadge label="Sample prices — set real prices in admin" />
        </p>
      )}
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {packages.map((p) => {
          const entry = p.bySize[size];
          const tier = tierColor(p.slug);
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
              <p aria-live="polite" className="flex items-baseline gap-2">
                <span className="text-sm text-fg-muted">from</span>
                <span key={size} className="tabular animate-fade-in font-display text-5xl font-bold">
                  {entry ? priceLabel(p.slug, size, entry.priceCents) : "—"}
                </span>
              </p>
              <p className="-mt-3 text-sm text-fg-subtle">About {entry ? formatDuration(entry.durationMin) : "—"}</p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {p.includedNames.map((n) => (
                  <li key={n} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0" style={{ color: tier }} aria-hidden="true" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/book?pkg=${p.slug}&size=${size}`}
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
