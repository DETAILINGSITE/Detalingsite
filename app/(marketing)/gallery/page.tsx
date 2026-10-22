import { FinalCta } from "@/components/marketing/final-cta";
import { GalleryGrid } from "@/components/marketing/gallery-grid";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageTransition } from "@/components/motion/page-transition";
import { getPublicCatalog, getPublicContent } from "@/lib/server/data/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Gallery",
  description: "Before-and-after results: paint correction, ceramic coatings, interior details and more.",
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
      <div className="container-site py-16 md:py-24">
        <SectionHeading as="h1" eyebrow="Gallery" title="The proof is in the paint." intro="Tap any project to compare before and after." />
        <div className="mt-12">
          <GalleryGrid items={items} />
        </div>
      </div>
      <FinalCta />
    </PageTransition>
  );
}
