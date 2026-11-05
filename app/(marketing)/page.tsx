import { business } from "@/config/business";
import { isPlaceholder } from "@/config/placeholder";
import { BeforeAfter } from "@/components/marketing/before-after";
import { FaqList } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/home/hero";
import { HowItWorks } from "@/components/marketing/home/how-it-works";
import { PackagesPricing } from "@/components/marketing/home/packages-pricing";
import { AddOnsList } from "@/components/marketing/home/addons-list";
import { TrustBar } from "@/components/marketing/home/trust-bar";
import { WhyUs } from "@/components/marketing/home/why-us";
import { MembershipCard } from "@/components/marketing/membership-card";
import { ReviewsCarousel } from "@/components/marketing/reviews-carousel";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ZipChecker } from "@/components/marketing/zip-checker";
import { PageTransition } from "@/components/motion/page-transition";
import { JsonLd } from "@/components/seo/json-ld";
import { CtaLink } from "@/components/ui/cta-link";
import { buttonVariants } from "@/components/ui/button";
import { getPublicCatalog, getPublicContent, getPublicSchedule } from "@/lib/server/data/public";
import { localBusinessJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Premium Mobile Car Detailing in Houston, TX",
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

      <section aria-labelledby="packages-title" className="section-pad" data-recede>
        <div className="container-site">
          <SectionHeading
            id="packages-title"
            eyebrow="Packages & pricing"
            title="Simple packages."
            accent="Honest prices."
            intro="Every package shows the price for cars and for trucks & SUVs. Add-ons and condition are confirmed when you book."
            align="center"
          />
          <div className="mt-6">
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
          <AddOnsList catalog={catalog} />
          <p className="mt-14 text-center">
            <CtaLink href="/pricing" variant="glass" size="md">
              See the full price list
            </CtaLink>
          </p>
        </div>
      </section>

      {showcase.length > 0 && (
        <section aria-labelledby="results-title" className="container-site section-pad" data-recede>
          <SectionHeading id="results-title" eyebrow="Results" title="Drag to see" accent="the difference." />
          <div className="mt-14 grid gap-8 lg:grid-cols-2" data-fan>
            {showcase.map((g, i) => (
              <div key={g.id} data-fan-item className="shell"><div className="core p-0"><BeforeAfter
                before={g.beforeSrc}
                after={g.afterSrc}
                altBefore={g.altBefore}
                altAfter={g.altAfter}
                width={g.width}
                height={g.height}
                isPlaceholder={g.isPlaceholder}
                peek={i === 0}
              /></div></div>
            ))}
          </div>
          <p className="mt-12">
            <CtaLink href="/gallery" variant="glass" size="md">
              View the gallery
            </CtaLink>
          </p>
        </section>
      )}

      <HowItWorks />
      <WhyUs />

      {content.testimonials.length > 0 && (
        <section aria-labelledby="reviews-title" className="section-pad relative border-y border-white/[0.06] bg-[#0a0c0f]">
          <div className="container-site">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionHeading id="reviews-title" eyebrow="Reviews" title="Drivers notice" accent="the difference." />
              {!isPlaceholder("links.gbp") && (
                <a href={business.links.googleBusinessProfile} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
                  Read all reviews on Google
                </a>
              )}
            </div>
            <div className="mt-14" data-depth>
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
      )}

      <section id="service-area" aria-labelledby="area-title" className="container-site section-pad grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-6">
          <SectionHeading
            id="area-title"
            eyebrow="Service area"
            title="Do you service"
            accent="my area?"
            intro="We bring everything — water, power and pro equipment — to homes and offices across Houston and the surrounding areas."
          />
          <ul className="flex flex-wrap gap-2" data-reveal>
            {[...new Set(schedule.zones.flatMap((z) => z.cities))].map((c) => (
              <li key={c} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-fg-muted transition-colors duration-300 hover:border-gold-400/40 hover:text-fg">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div data-depth><ZipChecker
          shopEnabled={business.shop.enabled && schedule.serviceMode !== "mobile"}
          zones={schedule.zones.map((z) => ({ name: z.name, zipCodes: z.zipCodes, travelFeeCents: z.travelFeeCents, cities: z.cities }))}
        /></div>
      </section>

      {business.flags.memberships && (
        <section aria-labelledby="members-title" className="container-site pb-24 md:pb-36" data-depth>
          <MembershipCard headingId="members-title" />
        </section>
      )}

      {featuredFaqs.length > 0 && (
        <section aria-labelledby="faq-title" className="container-site grid gap-12 pb-24 md:pb-36 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <div className="flex flex-col gap-6">
            <SectionHeading id="faq-title" eyebrow="FAQ" title="Good" accent="questions." />
            <CtaLink href="/faq" variant="glass" size="md" className="w-fit">
              All FAQs
            </CtaLink>
          </div>
          <div data-depth><FaqList items={featuredFaqs.map((f) => ({ id: f.id, question: f.question, answer: f.answerMd }))} /></div>
        </section>
      )}

      <FinalCta />
    </PageTransition>
  );
}
