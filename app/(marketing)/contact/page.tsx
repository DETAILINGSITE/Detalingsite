import { Clock, Mail, MessageSquare, Phone } from "lucide-react";
import { business } from "@/config/business";
import { ContactForm } from "@/components/forms/contact-form";
import { MapFacade } from "@/components/marketing/map-facade";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageTransition } from "@/components/motion/page-transition";
import { getPublicSchedule } from "@/lib/server/data/public";
import { WEEKDAYS, formatHhmm } from "@/lib/site/nav";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Contact",
  description: `Call, text or message ${business.name}. Hours, location and service area.`,
  path: "/contact",
});

export default async function ContactPage() {
  const schedule = await getPublicSchedule();
  const a = business.shop.address;
  return (
    <PageTransition>
      <div className="container-site grid gap-14 py-16 md:py-24 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-8">
          <SectionHeading as="h1" eyebrow="Contact" title="Let's talk about your car." intro="Questions, fleet enquiries or anything else — send a message and we'll reply within one business day." />
          <ContactForm />
        </div>
        <aside className="flex flex-col gap-6" aria-label="Contact details">
          <ul className="card flex flex-col gap-4 p-6">
            <li className="flex items-center gap-3">
              <Phone className="size-5 text-gold-300" aria-hidden="true" />
              <a href={`tel:${business.contact.phone}`} className="tabular inline-flex min-h-11 items-center hover:text-gold-300">{business.contact.phoneDisplay}</a>
            </li>
            <li className="flex items-center gap-3">
              <MessageSquare className="size-5 text-gold-300" aria-hidden="true" />
              <a href={`sms:${business.contact.sms}`} className="inline-flex min-h-11 items-center hover:text-gold-300">Text us</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="size-5 text-gold-300" aria-hidden="true" />
              <a href={`mailto:${business.contact.email}`} className="inline-flex min-h-11 items-center hover:text-gold-300">{business.contact.email}</a>
            </li>
          </ul>
          <div className="card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <Clock className="size-5 text-gold-300" aria-hidden="true" /> Hours
            </h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm text-fg-muted">
              {WEEKDAYS.map((d, i) => {
                const rows = schedule.hours.filter((h) => h.weekday === i + 1);
                return (
                  <div key={d} className="contents">
                    <dt>{d}</dt>
                    <dd className="tabular">{rows.length ? rows.map((h) => `${formatHhmm(h.opens)}–${formatHhmm(h.closes)}`).join(", ") : "Closed"}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
          {business.shop.enabled && (
            <MapFacade
              query={`${a.line1}, ${a.city}, ${a.region} ${a.postalCode}`}
              label={`${a.line1}, ${a.city}, ${a.region}`}
              mapsUrl={business.shop.mapsUrl}
            />
          )}
        </aside>
      </div>
    </PageTransition>
  );
}
