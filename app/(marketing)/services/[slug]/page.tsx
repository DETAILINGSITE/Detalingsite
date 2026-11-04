import { Check, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { BeforeAfter } from "@/components/marketing/before-after";
import { FaqList } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/final-cta";
import { ServiceArt } from "@/components/marketing/service-art";
import { PageTransition } from "@/components/motion/page-transition";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { formatDuration } from "@/lib/domain/money";
import { itemPriceLabel, priceLabel } from "@/lib/site/pricing-labels";
import { getPublicCatalog, getPublicContent } from "@/lib/server/data/public";
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateStaticParams() {
  const catalog = await getPublicCatalog();
  return catalog.services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = (await getPublicCatalog()).services.find((x) => x.slug === slug);
  if (!s) return {};
  return pageMetadata({
    title: s.seoTitle ?? s.name,
    description: s.seoDescription ?? `${s.summary} ${s.quoteOnly ? "Quoted per vehicle." : `${itemPriceLabel(s.slug, s.bySize, { capitalize: true })}.`}`,
    path: `/services/${s.slug}`,
  });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [catalog, content] = await Promise.all([getPublicCatalog(), getPublicContent()]);
  const s = catalog.services.find((x) => x.slug === slug);
  if (!s) notFound();
  const addons = catalog.services.filter((x) => x.kind === "addon" && x.id !== s.id).slice(0, 6);
  const faqs = content.faqs.filter((f) => f.serviceId === s.id || (f.serviceId === null && f.category === "Services")).slice(0, 6);
  const gallery = content.gallery.filter((g) => g.serviceId === s.id).slice(0, 2);
  // A package's own service is booked as that package (the booking page doesn't list it separately).
  const pkg = catalog.packages.find((p) => p.serviceIds.includes(s.id));
  const bookHref = s.quoteOnly ? `/quote?svc=${s.slug}` : pkg ? `/book?pkg=${pkg.slug}` : `/book?svc=${s.slug}`;

  return (
    <PageTransition>
      <JsonLd data={serviceJsonLd({ name: s.name, description: s.summary, slug: s.slug, fromCents: s.fromCents, quoteOnly: s.quoteOnly })} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }, { name: s.name, path: `/services/${s.slug}` }])} />
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.answerMd })))} />}

      <section className="container-site grid gap-10 pt-12 pb-16 md:pt-20 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-6">
          <nav aria-label="Breadcrumb" className="text-sm text-fg-subtle">
            <Link href="/services" transitionTypes={["nav-back"]} className="inline-flex min-h-11 items-center hover:text-fg">
              ← All services
            </Link>
          </nav>
          <h1 className="text-[clamp(2.2rem,5vw,4.2rem)] leading-[1] font-extrabold">{s.name}</h1>
          <p className="text-lg leading-relaxed text-fg-muted">{s.summary}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-semibold text-gold-300">{s.quoteOnly ? "Quoted per vehicle" : itemPriceLabel(s.slug, s.bySize, { capitalize: true })}</span>
            <span className="inline-flex items-center gap-1.5 text-fg-muted">
              <Clock className="size-4" aria-hidden="true" /> About {formatDuration(s.baseDurationMin)}
            </span>
            {s.isPlaceholder && <PlaceholderBadge label="Sample price" />}
          </div>
          {/* Stacked on phones: a side-by-side row could wrap differently once the web font loads (CLS). */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={bookHref} className={buttonVariants({ size: "lg" })}>
              {s.quoteOnly ? "Request a quote" : `Book ${s.name}`}
            </Link>
            <Link href="/contact" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Ask a question
            </Link>
          </div>
        </div>
        <ViewTransition name={`service-${s.slug}`} share="morph" default="none">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] border border-white/10">
            <ServiceArt slug={s.slug} category={s.categorySlug} className="size-full" />
          </div>
        </ViewTransition>
      </section>

      <section aria-labelledby="included-title" className="container-site grid gap-12 py-16 lg:grid-cols-2">
        <div>
          <h2 id="included-title" className="text-3xl font-bold">What's included</h2>
          <ul className="mt-6 flex flex-col gap-3">
            {s.includes.map((i) => (
              <li key={i} className="flex gap-3" data-reveal>
                <Check className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden="true" />
                {i}
              </li>
            ))}
          </ul>
          {s.descriptionMd && <p className="mt-8 leading-relaxed text-fg-muted">{s.descriptionMd}</p>}
          {s.whatToExpect.length > 0 && (
            <>
              <h3 className="mt-10 text-xl font-bold">Good to know</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-fg-muted">
                {s.whatToExpect.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        {!s.quoteOnly && (
          <div>
            <h2 className="text-3xl font-bold">Price by vehicle size</h2>
            <table className="mt-6 w-full text-left">
              <caption className="sr-only">{s.name} prices by vehicle size</caption>
              <thead className="text-sm text-fg-subtle">
                <tr>
                  <th scope="col" className="py-2 font-medium">Vehicle</th>
                  <th scope="col" className="py-2 font-medium">Price</th>
                  <th scope="col" className="py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {catalog.sizes.map((z) => (
                  <tr key={z.id}>
                    <th scope="row" className="py-3 font-semibold">{z.label}</th>
                    <td className="tabular py-3">{priceLabel(s.slug, z.id, s.bySize[z.id]?.priceCents ?? 0)}</td>
                    <td className="py-3 text-fg-muted">{formatDuration(s.bySize[z.id]?.durationMin ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {addons.length > 0 && (
              <>
                <h3 className="mt-10 text-xl font-bold">Popular add-ons</h3>
                <ul className="mt-4 flex flex-col divide-y divide-white/[0.08]">
                  {addons.map((a) => (
                    <li key={a.id} className="flex justify-between gap-4 py-3">
                      <Link href={`/services/${a.slug}`} className="hover:text-gold-300">{a.name}</Link>
                      <span className="tabular text-fg-muted">{itemPriceLabel(a.slug, a.bySize)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {gallery.length > 0 && (
        <section aria-labelledby="svc-gallery" className="container-site py-16">
          <h2 id="svc-gallery" className="text-3xl font-bold">Results</h2>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            {gallery.map((g) => (
              <BeforeAfter key={g.id} before={g.beforeSrc} after={g.afterSrc} altBefore={g.altBefore} altAfter={g.altAfter} width={g.width} height={g.height} isPlaceholder={g.isPlaceholder} />
            ))}
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section aria-labelledby="svc-faq" className="container-site py-16">
          <h2 id="svc-faq" className="mb-6 text-3xl font-bold">Questions</h2>
          <FaqList items={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answerMd }))} />
        </section>
      )}
      <FinalCta title={s.quoteOnly ? "Tell us about your project." : `Book your ${s.name.toLowerCase()}.`} />
    </PageTransition>
  );
}
