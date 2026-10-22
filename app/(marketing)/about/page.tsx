import { business } from "@/config/business";
import { isPlaceholder } from "@/config/placeholder";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ServiceArt } from "@/components/marketing/service-art";
import { PageTransition } from "@/components/motion/page-transition";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "About",
  description: `The story, team, equipment and standards behind ${business.name}.`,
  path: "/about",
});

export default function AboutPage() {
  const p = business.proof;
  return (
    <PageTransition>
      <section className="container-site grid gap-14 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-6">
          <SectionHeading as="h1" eyebrow="About us" title="Small team. Big standards." />
          <PlaceholderBadge label="Sample story — write your own" />
          <p className="text-lg leading-relaxed text-fg-muted" data-reveal>
            Replace this with your story: how the business started, who does the work, and what you refuse to compromise on.
            Real details build trust far better than polished copy.
          </p>
          <p className="leading-relaxed text-fg-muted" data-reveal>
            {p.yearsInBusiness} years in business · {p.carsDetailed.toLocaleString("en-US")}+ cars detailed
            {isPlaceholder("proof.years") && " (sample figures)"}
          </p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-white/10">
          <div data-parallax="6" className="absolute -inset-y-[8%] inset-x-0">
            <ServiceArt slug="about-team" category="interior" className="size-full" />
          </div>
          <PlaceholderBadge className="absolute bottom-4 left-4" label="Sample image — add a team photo" />
        </div>
      </section>

      <section aria-labelledby="standards" className="container-site grid gap-6 pb-24 md:grid-cols-3">
        <h2 id="standards" className="sr-only">Our standards</h2>
        <div className="card p-6" data-reveal>
          <h3 className="text-lg font-bold">Equipment & products</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            {p.productsUsed.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          {isPlaceholder("proof.products") && <PlaceholderBadge className="mt-3" label="Sample" />}
        </div>
        <div className="card p-6" data-reveal>
          <h3 className="text-lg font-bold">Certifications</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            {p.certifications.map((x) => (
              <li key={x}>{x}</li>
            ))}
            {p.insured && <li>Fully insured</li>}
          </ul>
          {isPlaceholder("proof.certifications") && <PlaceholderBadge className="mt-3" label="Sample — real certifications only" />}
        </div>
        <div className="card p-6" data-reveal>
          <h3 className="text-lg font-bold">Our guarantee</h3>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">{p.guarantee}</p>
        </div>
      </section>
      <FinalCta />
    </PageTransition>
  );
}
