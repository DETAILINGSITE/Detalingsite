import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { formatDuration } from "@/lib/domain/money";
import { itemPriceLabel } from "@/lib/site/pricing-labels";
import { ServiceArt } from "./service-art";

export interface ServiceCardData {
  slug: string;
  name: string;
  summary: string;
  bySize: Record<string, { priceCents: number }>;
  baseDurationMin: number;
  quoteOnly: boolean;
  categorySlug: string | null;
}

/** The card's art is the shared-element morph source for /services/[slug]'s hero. */
export function ServiceCard({ s }: { s: ServiceCardData }) {
  return (
    <Link
      href={`/services/${s.slug}`}
      transitionTypes={["nav-forward"]}
      className="group card glint relative flex h-full flex-col overflow-hidden rounded-[2rem]"
      data-tilt="5"
    >
      <span className="spot z-10" aria-hidden="true" />
      <ViewTransition name={`service-${s.slug}`} share="morph" default="none">
        <div className="relative aspect-[16/10] overflow-hidden">
          <ServiceArt slug={s.slug} category={s.categorySlug} className="size-full transition-transform duration-700 group-hover:scale-[1.04]" />
        </div>
      </ViewTransition>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold text-fg">{s.name}</h3>
          <ArrowUpRight className="size-5 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold-300" aria-hidden="true" />
        </div>
        <p className="text-sm leading-relaxed text-fg-muted">{s.summary}</p>
        <div className="mt-auto pt-2 text-sm">
          <p className="font-semibold text-gold-300">{s.quoteOnly ? "Quoted per vehicle" : itemPriceLabel(s.slug, s.bySize, { capitalize: true })}</p>
          <p className="mt-0.5 text-fg-subtle">About {formatDuration(s.baseDurationMin)}</p>
        </div>
      </div>
    </Link>
  );
}
