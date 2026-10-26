import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { business } from "@/config/business";
import { FinalCta } from "@/components/marketing/final-cta";
import { ServiceCard } from "@/components/marketing/service-card";
import { PageTransition } from "@/components/motion/page-transition";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { formatMoney } from "@/lib/domain/money";
import { getCityPage, getPublicCatalog, getPublicContent, getPublicSchedule } from "@/lib/server/data/public";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

/** Only published city pages are generated (doorway-page guard, docs/PLAN.md §10.23). */
export async function generateStaticParams() {
  const { cities } = await getPublicContent();
  return cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const page = await getCityPage(city);
  if (!page) return {};
  return pageMetadata({
    title: `Car Detailing in ${page.city}, ${page.region}`,
    description: `Mobile car detailing in ${page.city}: maintenance washes, interior refreshes, full details and showroom finishes at your home or office. Book online.`,
    path: `/areas/${page.slug}`,
  });
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const [page, catalog, schedule] = await Promise.all([getCityPage(city), getPublicCatalog(), getPublicSchedule()]);
  if (!page) notFound();
  const zone = schedule.zones.find((z) => z.id === page.zoneId);
  const services = catalog.services.filter((s) => s.kind === "service" && !s.quoteOnly).slice(0, 3);
  return (
    <PageTransition>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: page.city, path: `/areas/${page.slug}` }])} />
      <section className="container-site flex flex-col gap-6 py-16 md:py-24">
        <p className="eyebrow">Service area</p>
        <h1 className="max-w-3xl text-[clamp(2.2rem,5vw,4rem)] leading-[1] font-extrabold">
          Car detailing in {page.city}, {page.region}
        </h1>
        {page.isPlaceholder && <PlaceholderBadge label="Sample city page — add genuinely local content" />}
        <p className="max-w-2xl text-lg leading-relaxed text-fg-muted">{page.introMd}</p>
        {page.localNotesMd && <p className="max-w-2xl leading-relaxed text-fg-muted">{page.localNotesMd}</p>}
        {zone && (
          <p className="text-sm text-fg-muted">
            {zone.name} · {zone.travelFeeCents ? `travel fee ${formatMoney(zone.travelFeeCents)}` : "no travel fee"}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={`/book?zip=${zone?.zipCodes[0] ?? ""}`} className={buttonVariants({ size: "lg" })}>
            Book in {page.city}
          </Link>
          <a href={`tel:${business.contact.phone}`} className={buttonVariants({ size: "lg", variant: "secondary" })}>
            Call {business.contact.phoneDisplay}
          </a>
        </div>
      </section>
      <section aria-labelledby="city-services" className="container-site pb-16">
        <h2 id="city-services" className="text-2xl font-bold">Popular in {page.city}</h2>
        <ul className="mt-6 grid gap-5 md:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <ServiceCard s={s} />
            </li>
          ))}
        </ul>
      </section>
      <FinalCta title={`Detailing that comes to you in ${page.city}.`} />
    </PageTransition>
  );
}
