import { FaqList } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/final-cta";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageTransition } from "@/components/motion/page-transition";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublicContent } from "@/lib/server/data/public";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "FAQ",
  description: "Answers about booking, deposits, mobile service, ceramic coatings, pricing by vehicle size and more.",
  path: "/faq",
});

export default async function FaqPage() {
  const { faqs } = await getPublicContent();
  const groups = [...new Set(faqs.map((f) => f.category))];
  return (
    <PageTransition>
      <JsonLd data={faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.answerMd })))} />
      <div className="container-site py-16 md:py-24">
        <SectionHeading as="h1" eyebrow="FAQ" title="Questions, answered." />
        <div className="mt-12 flex flex-col gap-14">
          {groups.map((g) => (
            <section key={g} aria-labelledby={`faq-${g}`}>
              <h2 id={`faq-${g}`} className="mb-4 text-2xl font-bold">{g}</h2>
              <FaqList items={faqs.filter((f) => f.category === g).map((f) => ({ id: f.id, question: f.question, answer: f.answerMd }))} />
            </section>
          ))}
        </div>
      </div>
      <FinalCta />
    </PageTransition>
  );
}
