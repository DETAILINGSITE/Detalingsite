import type { MetadataRoute } from "next";
import { business } from "@/config/business";
import { getPublicCatalog, getPublicContent } from "@/lib/server/data/public";
import { siteUrl } from "@/lib/seo/jsonld";

const STATIC = ["", "/services", "/pricing", "/gallery", "/about", "/reviews", "/faq", "/contact", "/quote", "/book", "/privacy", "/terms", "/cancellation-policy", "/accessibility"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [catalog, content] = await Promise.all([getPublicCatalog(), getPublicContent()]);
  return [
    ...STATIC.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.7 })),
    ...(business.flags.giftCards ? [{ url: `${base}/gift-cards`, priority: 0.4 }] : []),
    ...catalog.services.map((s) => ({ url: `${base}/services/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...content.cities.map((c) => ({ url: `${base}/areas/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
