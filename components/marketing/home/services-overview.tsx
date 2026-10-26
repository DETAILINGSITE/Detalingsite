import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { PublicCatalog } from "@/lib/server/data/public";
import { SectionHeading } from "../section-heading";
import { ServiceCard } from "../service-card";

export function ServicesOverview({ catalog }: { catalog: PublicCatalog }) {
  // The four detail packages come first (lowest sort), then the next services; the rest are on /services.
  const cards = catalog.services.filter((s) => s.kind === "service").slice(0, 6);

  return (
    <section aria-labelledby="services-title" className="container-site py-24 md:py-32">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <SectionHeading
          id="services-title"
          eyebrow="Services"
          title="Every surface, done properly."
          intro="From a fresh wash to multi-stage paint correction and ceramic protection — choose a service or let us build the right package for your car."
        />
        <Link href="/services" className={buttonVariants({ variant: "secondary" })}>
          All services
        </Link>
      </div>
      <ul className="-mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {cards.map((s) => (
          <li key={s.id} className="w-[80%] shrink-0 snap-start sm:w-auto">
            <ServiceCard s={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}
