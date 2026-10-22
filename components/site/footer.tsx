import Link from "next/link";
import { business } from "@/config/business";
import { getPublicSchedule } from "@/lib/server/data/public";
import { LEGAL, NAV, WEEKDAYS, formatHhmm } from "@/lib/site/nav";
import { Logo } from "./logo";

export async function Footer() {
  const schedule = await getPublicSchedule();
  const cities = [...new Set(schedule.zones.flatMap((z) => z.cities))];
  const socials = [
    ["Instagram", business.links.instagram],
    ["Facebook", business.links.facebook],
    ["TikTok", business.links.tiktok],
    ["YouTube", business.links.youtube],
    ["Google", business.links.googleBusinessProfile],
  ].filter((x): x is [string, string] => Boolean(x[1]));

  return (
    <footer className="border-t border-white/[0.07] bg-ink-950 pb-[calc(var(--mobile-bar-h)+2rem)] md:pb-12">
      <div className="container-site grid gap-10 pt-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-fg-muted">{business.tagline}</p>
          <address className="flex flex-col gap-1 text-sm not-italic text-fg-muted">
            <a href={`tel:${business.contact.phone}`} className="tabular hover:text-fg">{business.contact.phoneDisplay}</a>
            <a href={`mailto:${business.contact.email}`} className="hover:text-fg">{business.contact.email}</a>
            {business.shop.enabled && (
              <span>
                {business.shop.address.line1}, {business.shop.address.city}, {business.shop.address.region}
              </span>
            )}
          </address>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-semibold text-fg">Hours</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-fg-muted">
            {WEEKDAYS.map((day, i) => {
              const rows = schedule.hours.filter((h) => h.weekday === i + 1);
              return (
                <div key={day} className="contents">
                  <dt>{day.slice(0, 3)}</dt>
                  <dd className="tabular">{rows.length ? rows.map((h) => `${formatHhmm(h.opens)}–${formatHhmm(h.closes)}`).join(", ") : "Closed"}</dd>
                </div>
              );
            })}
          </dl>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-semibold text-fg">Service area</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-fg-muted">
            {cities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Link href="/#service-area" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-gold-300 hover:underline">
            Check your ZIP
          </Link>
        </div>
        <div className="flex flex-col gap-6">
          <nav aria-label="Footer">
            <h2 className="mb-4 text-sm font-semibold text-fg">Explore</h2>
            <ul className="grid grid-cols-2 gap-x-4 text-sm text-fg-muted">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="inline-flex min-h-11 items-center hover:text-fg">{n.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 text-sm text-fg-muted" aria-label="Social media">
              {socials.map(([label, href]) => (
                <li key={label}>
                  <a href={href} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-11 items-center hover:text-fg">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="container-site mt-12 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-fg-subtle md:flex-row md:items-center md:justify-between">
        <p>© {business.legalName}. All rights reserved.</p>
        <ul className="flex flex-wrap gap-x-4">
          {LEGAL.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex min-h-11 items-center hover:text-fg">{l.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
