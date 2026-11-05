import { business } from "@/config/business";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageTransition } from "@/components/motion/page-transition";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "About",
  description: `${business.name} is a mobile auto detailing service serving Houston, TX and the surrounding areas.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <PageTransition>
      <section className="container-site py-20 md:py-32">
        <div className="flex max-w-3xl flex-col gap-6">
          <SectionHeading as="h1" eyebrow="About us" title="Mobile detailing," accent="done right." />
          <p className="text-lg leading-relaxed text-fg-muted" data-reveal>
            {business.name} is a mobile auto detailing service serving Houston and the surrounding areas. We bring
            professional-quality products and our own equipment to you, whether that&apos;s a routine maintenance wash or a full
            showroom finish.
          </p>
          <p className="leading-relaxed text-fg-muted" data-reveal>
            Pick a package online, choose a time, and we take care of the rest at your home, office or wherever you park.
          </p>
        </div>
      </section>

      <section aria-labelledby="standards" className="container-site grid gap-6 pb-24 md:grid-cols-3">
        <h2 id="standards" className="sr-only">Our standards</h2>
        <div className="card p-6" data-reveal>
          <h3 className="text-lg font-bold">Professional quality products</h3>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">The right products on every vehicle, from a maintenance wash to a showroom finish.</p>
        </div>
        <div className="card p-6" data-reveal>
          <h3 className="text-lg font-bold">100% mobile</h3>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">We come to you, with our own water, power and equipment.</p>
        </div>
        <div className="card p-6" data-reveal>
          <h3 className="text-lg font-bold">Our guarantee</h3>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">{business.proof.guarantee}</p>
        </div>
      </section>
      <FinalCta />
    </PageTransition>
  );
}
