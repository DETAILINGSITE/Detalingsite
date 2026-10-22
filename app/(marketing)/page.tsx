import Link from "next/link";
import { business } from "@/config/business";
import { BeforeAfter } from "@/components/marketing/before-after";
import { FaqList } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/home/hero";
import { HowItWorks } from "@/components/marketing/home/how-it-works";
import { PackagesPricing } from "@/components/marketing/home/packages-pricing";
import { ServicesOverview } from "@/components/marketing/home/services-overview";
import { TrustBar } from "@/components/marketing/home/trust-bar";
import { WhyUs } from "@/components/marketing/home/why-us";
import { ReviewsCarousel } from "@/components/marketing/reviews-carousel";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ZipChecker } from "@/components/marketing/zip-checker";
import { PageTransition } from "@/components/motion/page-transition";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { getPublicCatalog, getPublicContent, getPublicSchedule } from "@/lib/server/data/public";
import { localBusinessJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Premium Mobile & In-Shop Car Detailing",
  description: business.description,
  path: "/",
});

export default async function HomePage() {
  const [catalog, content, schedule] = await Promise.all([getPublicCatalog(), getPublicContent(), getPublicSchedule()]);
  const featuredFaqs = content.faqs.filter((f) => f.featured).slice(0, 5);
  const showcase = content.gallery.slice(0, 2);

  return (
    <PageTransition>
      <JsonLd data={localBusinessJsonLd({ hours: schedule.hours, cities: schedule.zones.flatMap((z) => z.cities) })} />
      <Hero />
      <TrustBar />
      <ServicesOverview catalog={catalog} />

      <section aria-labelledby="packages-title" className="bg-ink-850 py-24 md:py-32">
        <div className="container-site">
          <SectionHeading
            id="packages-title"
            eyebrow="Packages & pricing"
            title="Simple packages. Honest prices."
            intro="Choose your vehicle size to see exact starting prices. Add-ons and condition are confirmed when you book."
            align="center"
          />
          <div className="mt-12">
            <PackagesPricing
              sizes={catalog.sizes.map((z) => ({ id: z.id, label: z.label }))}
              packages={catalog.packages.map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                tagline: p.tagline,
                featured: p.featured,
                isPlaceholder: p.isPlaceholder,
                includedNames: p.includedNames,
                bySize: p.bySize,
              }))}
            />
          </div>
          <p className="mt-8 text-center">
            <Link href="/pricing" className={buttonVariants({ variant: "link" })}>
              See the full price list
            </Link>
          </p>
        </div>
      </section>

      {showcase.length > 0 && (
        <section aria-labelledby="results-title" className="container-site py-24 md:py-32">
          <SectionHeading id="results-title" eyebrow="Results" title="Drag to see the difference." />
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {showcase.map((g, i) => (
              <BeforeAfter
                key={g.id}
                before={g.beforeSrc}
                after={g.afterSrc}
                altBefore={g.altBefore}
                altAfter={g.altAfter}
                width={g.width}
                height={g.height}
                isPlaceholder={g.isPlaceholder}
                peek={i === 0}
              />
            ))}
          </div>
          <p className="mt-8">
            <Link href="/gallery" className={buttonVariants({ variant: "secondary" })}>
              View the gallery
            </Link>
          </p>
        </section>
      )}

      <HowItWorks />
      <WhyUs />

      <section aria-labelledby="reviews-title" className="bg-ink-850 py-24 md:py-32">
        <div className="container-site">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading id="reviews-title" eyebrow="Reviews" title="Drivers notice the difference." />
            <a href={business.links.googleBusinessProfile} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
              Read all reviews on Google
            </a>
          </div>
          <div className="mt-12">
            <ReviewsCarousel
              reviews={content.testimonials.map((t) => ({
                id: t.id,
                authorName: t.authorName,
                vehicle: t.vehicle,
                rating: t.rating,
                body: t.body,
                source: t.source,
                isPlaceholder: t.isPlaceholder,
              }))}
            />
          </div>
        </div>
      </section>

      <section id="service-area" aria-labelledby="area-title" className="container-site grid gap-12 py-24 md:py-32 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <SectionHeading
            id="area-title"
            eyebrow="Service area"
            title="Do you service my area?"
            intro="We bring everything — water, power and pro equipment — to homes and offices across these neighbourhoods."
          />
          <ul className="flex flex-wrap gap-2" data-reveal>
            {[...new Set(schedule.zones.flatMap((z) => z.cities))].map((c) => (
              <li key={c} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-fg-muted">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <ZipChecker
          shopEnabled={business.shop.enabled && schedule.serviceMode !== "mobile"}
          zones={schedule.zones.map((z) => ({ name: z.name, zipCodes: z.zipCodes, travelFeeCents: z.travelFeeCents, cities: z.cities }))}
        />
      </section>

      {business.flags.memberships && (
        <section aria-labelledby="members-title" className="container-site pb-24">
          <div className="card flex flex-col items-start gap-5 p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div>
              <p className="eyebrow">Maintenance plans</p>
              <h2 id="members-title" className="mt-2 text-3xl font-bold">Keep it this clean, all year.</h2>
              <p className="mt-2 max-w-xl text-fg-muted">Regular maintenance washes at a member rate. Ask us about a plan for your car.</p>
            </div>
            <Link href="/contact?topic=membership" className={buttonVariants()}>
              Ask about memberships
            </Link>
          </div>
        </section>
      )}

      {featuredFaqs.length > 0 && (
        <section aria-labelledby="faq-title" className="container-site grid gap-12 pb-24 md:pb-32 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-6">
            <SectionHeading id="faq-title" eyebrow="FAQ" title="Good questions." />
            <Link href="/faq" className={buttonVariants({ variant: "secondary" }) + " w-fit"}>
              All FAQs
            </Link>
          </div>
          <FaqList items={featuredFaqs.map((f) => ({ id: f.id, question: f.question, answer: f.answerMd }))} />
        </section>
      )}

      <FinalCta />
    </PageTransition>
  );
}
