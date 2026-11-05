import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { PublicCatalog } from "@/lib/server/data/public";
import { priceLabel } from "@/lib/site/pricing-labels";

/** The add-on services as an editorial price list under the package cards. */
export function AddOnsList({ catalog }: { catalog: PublicCatalog }) {
  const addons = catalog.services.filter((s) => s.kind === "addon");
  if (addons.length === 0) return null;
  const firstSize = catalog.sizes[0]?.id ?? "sedan";
  return (
    <div className="mt-24 grid gap-10 md:mt-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16" data-depth>
      <div>
        <h3 className="text-[clamp(1.9rem,3.6vw,3rem)] leading-[1] font-bold tracking-[-0.03em]">
          Add-ons, <span className="serif electric font-normal">à la carte.</span>
        </h3>
        <p className="mt-4 max-w-sm text-fg-muted">Add any of these to a package when you book.</p>
      </div>
      <ul className="border-t border-white/[0.08]">
        {addons.map((a) => (
          <li key={a.id} className="border-b border-white/[0.08]">
            <Link href={`/services/${a.slug}`} className="glint group flex items-center gap-4 py-5 sm:gap-5 md:gap-8 md:py-6">
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-fg transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1.5 md:text-xl">
                  {a.name}
                </span>
                <span className="mt-1 block text-sm text-fg-muted">{a.summary}</span>
              </span>
              <span className="tabular shrink-0 text-right font-display text-lg font-bold text-gold-200 sm:text-xl md:text-2xl">
                {priceLabel(a.slug, firstSize, a.bySize[firstSize]?.priceCents ?? a.fromCents)}
              </span>
              <span className="btn-orb btn-orb-light mr-0 hidden shrink-0 text-fg-subtle group-hover:text-gold-300 sm:inline-flex" aria-hidden="true">
                <ArrowUpRight strokeWidth={1.5} className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
