import { Star } from "lucide-react";
import { business } from "@/config/business";
import { isPlaceholder } from "@/config/placeholder";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageTransition } from "@/components/motion/page-transition";
import { buttonVariants } from "@/components/ui/button";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { getPublicContent } from "@/lib/server/data/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Reviews",
  description: "What our customers say about our detailing work — real reviews from Google and more.",
  path: "/reviews",
});

export default async function ReviewsPage() {
  const { testimonials } = await getPublicContent();
  return (
    <PageTransition>
      <div className="container-site py-16 md:py-24">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <SectionHeading
            as="h1"
            eyebrow="Reviews"
            title="Real drivers. Real results."
            intro={
              <>
                Rated <strong className="text-fg">{business.proof.rating.value.toFixed(1)}</strong> from{" "}
                {business.proof.rating.count} reviews on Google.{" "}
                {isPlaceholder("proof.rating") && <PlaceholderBadge label="Sample rating" />}
              </>
            }
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={business.links.googleReviews} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
              Leave a review
            </a>
            <a href={business.links.googleBusinessProfile} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
              See all on Google
            </a>
          </div>
        </div>
        <ul className="mt-12 columns-1 gap-5 md:columns-2 lg:columns-3">
          {testimonials.map((t) => (
            <li key={t.id} className="card mb-5 break-inside-avoid p-6" data-reveal>
              <div className="flex items-center justify-between">
                <span className="flex text-gold-300" role="img" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: t.rating }, (_, i) => (
                    <Star key={i} className="size-4 fill-current" aria-hidden="true" />
                  ))}
                </span>
                {t.isPlaceholder && <PlaceholderBadge label="Sample" />}
              </div>
              <blockquote className="mt-4 leading-relaxed">“{t.body}”</blockquote>
              <p className="mt-4 text-sm text-fg-muted">
                <span className="font-semibold text-fg">{t.authorName}</span>
                {t.vehicle ? ` · ${t.vehicle}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <FinalCta />
    </PageTransition>
  );
}
