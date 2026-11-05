import Link from "next/link";
import { FinalCta } from "@/components/marketing/final-cta";
import { GalleryGrid } from "@/components/marketing/gallery-grid";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageTransition } from "@/components/motion/page-transition";
import { buttonVariants } from "@/components/ui/button";
import { getPublicCatalog, getPublicContent } from "@/lib/server/data/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Gallery",
  description: "Before-and-after photos of our mobile detailing work.",
  path: "/gallery",
});

export default async function GalleryPage() {
  const [content, catalog] = await Promise.all([getPublicContent(), getPublicCatalog()]);
  const items = content.gallery.map((g) => {
    const svc = catalog.services.find((s) => s.id === g.serviceId);
    return {
      id: g.id,
      title: g.title,
      vehicle: g.vehicle,
      serviceSlug: svc?.slug ?? null,
      serviceName: svc?.name ?? null,
      beforeSrc: g.beforeSrc,
      afterSrc: g.afterSrc,
      altBefore: g.altBefore,
      altAfter: g.altAfter,
      width: g.width,
      height: g.height,
      isPlaceholder: g.isPlaceholder,
    };
  });
  return (
    <PageTransition>
      <div className="container-site py-20 md:py-32">
        <SectionHeading
          as="h1"
          eyebrow="Gallery"
          title="The proof is" accent="in the paint."
          intro={items.length > 0 ? "Tap any project to compare before and after." : "Photos of our recent work are coming soon."}
        />
        <div className="mt-12">
          {items.length > 0 ? (
            <GalleryGrid items={items} />
          ) : (
            <div className="card flex flex-col items-start gap-4 p-8" data-reveal>
              <p className="text-lg font-semibold">Before-and-after photos are on the way.</p>
              <p className="max-w-xl text-fg-muted">We&apos;re adding photos from recent jobs. In the meantime, see what&apos;s included in each package.</p>
              <Link href="/pricing" className={buttonVariants({ variant: "secondary" })}>
                See packages and prices
              </Link>
            </div>
          )}
        </div>
      </div>
      <FinalCta />
    </PageTransition>
  );
}
