import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/jsonld";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/booking/", "/book/", "/quote/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
