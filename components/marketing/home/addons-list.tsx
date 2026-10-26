import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { PublicCatalog } from "@/lib/server/data/public";
import { priceLabel } from "@/lib/site/pricing-labels";

/** The add-on services with their prices, shown under the package cards. */
export function AddOnsList({ catalog }: { catalog: PublicCatalog }) {
  const addons = catalog.services.filter((s) => s.kind === "addon");
  if (addons.length === 0) return null;
  const firstSize = catalog.sizes[0]?.id ?? "sedan";
  return (
    <div className="mt-16 md:mt-20">
      <h3 className="text-center text-2xl font-bold">Add-ons</h3>
      <p className="mx-auto mt-2 max-w-xl text-center text-fg-muted">Add any of these to a package when you book.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
        {addons.map((a) => (
          <li key={a.id}>
            <Link
              href={`/services/${a.slug}`}
              className="card group flex h-full flex-col gap-1.5 p-5 transition-transform duration-300 hover:-translate-y-0.5"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-semibold text-fg">{a.name}</span>
                <span className="tabular shrink-0 font-semibold text-gold-300">
                  {priceLabel(a.slug, firstSize, a.bySize[firstSize]?.priceCents ?? a.fromCents)}
                </span>
              </span>
              <span className="flex items-end justify-between gap-3 text-sm text-fg-muted">
                <span>{a.summary}</span>
                <ArrowUpRight className="size-4 shrink-0 text-fg-subtle transition-colors group-hover:text-gold-300" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
