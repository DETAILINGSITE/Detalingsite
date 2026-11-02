/** JSON-LD builders (docs/PLAN.md §9 SEO). AggregateRating only when the rating is real. */
import { isPlaceholder } from "@/config/placeholder";
import { business } from "@/config/business";
import type { BusinessHoursRow } from "@/lib/domain/settings";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function localBusinessJsonLd(opts: { hours: BusinessHoursRow[]; cities: string[] }) {
  const url = siteUrl();
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutoWash",
    "@id": `${url}/#business`,
    name: business.name,
    description: business.description,
    url,
    telephone: business.contact.phone,
    ...(isPlaceholder("contact.email") ? {} : { email: business.contact.email }),
    image: `${url}/opengraph-image`,
    priceRange: "$$",
    areaServed: opts.cities.map((c) => ({ "@type": "City", name: c })),
    openingHoursSpecification: opts.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAYS[h.weekday - 1]}`,
      opens: h.opens,
      closes: h.closes,
    })),
    sameAs: [
      isPlaceholder("links.instagram") ? null : business.links.instagram,
      isPlaceholder("links.facebook") ? null : business.links.facebook,
      isPlaceholder("links.gbp") ? null : business.links.googleBusinessProfile,
    ].filter(Boolean),
  };
  if (business.shop.enabled) {
    const a = business.shop.address;
    data.address = {
      "@type": "PostalAddress",
      streetAddress: [a.line1, a.line2].filter(Boolean).join(", "),
      addressLocality: a.city,
      addressRegion: a.region,
      postalCode: a.postalCode,
      addressCountry: a.country,
    };
    data.geo = { "@type": "GeoCoordinates", latitude: business.shop.geo.lat, longitude: business.shop.geo.lng };
  }
  if (business.proof.rating.isReal && business.proof.rating.count > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: business.proof.rating.value,
      reviewCount: business.proof.rating.count,
    };
  }
  return data;
}

export function serviceJsonLd(s: { name: string; description: string; slug: string; fromCents: number; quoteOnly: boolean }) {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.name,
    description: s.description,
    url: `${url}/services/${s.slug}`,
    provider: { "@id": `${url}/#business` },
    serviceType: "Car detailing",
    ...(s.quoteOnly
      ? {}
      : {
          offers: {
            "@type": "Offer",
            priceCurrency: business.currency,
            price: (s.fromCents / 100).toFixed(2),
            priceSpecification: { "@type": "PriceSpecification", minPrice: (s.fromCents / 100).toFixed(2), priceCurrency: business.currency },
          },
        }),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${url}${it.path}` })),
  };
}
