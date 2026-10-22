import type { Metadata } from "next";
import { business } from "@/config/business";

/** Unique title/description + canonical + OG/Twitter per page. */
export function pageMetadata(opts: { title: string; description: string; path: string; noindex?: boolean }): Metadata {
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: { title: `${opts.title} | ${business.name}`, description: opts.description, url: opts.path },
    twitter: { title: `${opts.title} | ${business.name}`, description: opts.description },
    ...(opts.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
