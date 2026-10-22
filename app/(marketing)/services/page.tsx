import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ServiceCard } from "@/components/marketing/service-card";
import { PageTransition } from "@/components/motion/page-transition";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublicCatalog } from "@/lib/server/data/public";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Detailing Services",
  description: "Exterior, interior, paint correction, ceramic coating, PPF and more — every detailing service we offer, with prices by vehicle size.",
  path: "/services",
});

export default async function ServicesPage() {
  const catalog = await getPublicCatalog();
  return (
    <PageTransition>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }])} />
      <div className="container-site pt-16 pb-8 md:pt-24">
        <SectionHeading as="h1" eyebrow="Services" title="Detailing, done properly." intro="Every service is priced by vehicle size and booked online. Not sure what you need? Request a custom quote." />
      </div>
      {catalog.categories.map((cat) => {
        const list = catalog.services.filter((s) => s.categoryId === cat.id);
        if (!list.length) return null;
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.slug}`} className="container-site py-12">
            <h2 id={`cat-${cat.slug}`} className="text-2xl font-bold">
              {cat.name}
            </h2>
            <p className="mt-2 max-w-2xl text-fg-muted">{cat.description}</p>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <li key={s.id}>
                  <ServiceCard s={s} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div className="pt-12">
        <FinalCta />
      </div>
    </PageTransition>
  );
}
