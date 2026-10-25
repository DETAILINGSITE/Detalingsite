import Link from "next/link";
import { business } from "@/config/business";
import { FinalCta } from "@/components/marketing/final-cta";
import { MembershipCard } from "@/components/marketing/membership-card";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageTransition } from "@/components/motion/page-transition";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { formatMoney } from "@/lib/domain/money";
import { getPublicCatalog, getPublicSchedule } from "@/lib/server/data/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Pricing",
  description: "Full detailing price list by vehicle size — packages, individual services, add-ons, travel fees and deposit policy.",
  path: "/pricing",
});

function PriceTable({
  caption,
  rows,
  sizes,
}: {
  caption: string;
  rows: { id: string; name: string; href?: string; quoteOnly?: boolean; bySize: Record<string, { priceCents: number }> }[];
  sizes: { id: string; label: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/10" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[640px] text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-ink-800 text-sm text-fg-subtle">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Service</th>
            {sizes.map((z) => (
              <th key={z.id} scope="col" className="px-5 py-3 font-medium">{z.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-white/[0.02]">
              <th scope="row" className="px-5 py-4 font-semibold">
                {r.href ? <Link href={r.href} className="hover:text-gold-300">{r.name}</Link> : r.name}
              </th>
              {sizes.map((z) => (
                <td key={z.id} className="tabular px-5 py-4 text-fg-muted">
                  {r.quoteOnly ? "Quote" : formatMoney(r.bySize[z.id]?.priceCents ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PricingPage() {
  const [catalog, schedule] = await Promise.all([getPublicCatalog(), getPublicSchedule()]);
  const sizes = catalog.sizes.map((z) => ({ id: z.id, label: z.label }));
  // A package's own service is already priced in the Packages table; don't list it twice.
  const packageServiceIds = new Set(catalog.packages.flatMap((p) => p.serviceIds));
  const services = catalog.services.filter((s) => s.kind === "service" && !packageServiceIds.has(s.id));
  const addons = catalog.services.filter((s) => s.kind === "addon");
  const deposit = catalog.deposit;

  return (
    <PageTransition>
      <div className="container-site flex flex-col gap-14 py-16 md:py-24">
        <SectionHeading as="h1" eyebrow="Pricing" title="Clear prices for every vehicle." intro="Prices are per vehicle and include all products and equipment. Heavy soiling, pet hair or stains may add a surcharge, shown before you pay." />
        {catalog.packages.some((p) => p.isPlaceholder) && <PlaceholderBadge label="Sample prices — the owner sets real prices in admin" />}

        <section aria-labelledby="p-packages" className="flex flex-col gap-5">
          <h2 id="p-packages" className="text-2xl font-bold">Packages</h2>
          <PriceTable caption="Package prices by vehicle size" sizes={sizes} rows={catalog.packages.map((p) => ({ id: p.id, name: p.name, href: `/book?pkg=${p.slug}`, bySize: p.bySize }))} />
        </section>
        <section aria-labelledby="p-services" className="flex flex-col gap-5">
          <h2 id="p-services" className="text-2xl font-bold">Individual services</h2>
          <PriceTable caption="Service prices by vehicle size" sizes={sizes} rows={services.map((s) => ({ id: s.id, name: s.name, href: `/services/${s.slug}`, quoteOnly: s.quoteOnly, bySize: s.bySize }))} />
        </section>
        <section aria-labelledby="p-addons" className="flex flex-col gap-5">
          <h2 id="p-addons" className="text-2xl font-bold">Add-ons</h2>
          <PriceTable caption="Add-on prices by vehicle size" sizes={sizes} rows={addons.map((s) => ({ id: s.id, name: s.name, href: `/services/${s.slug}`, bySize: s.bySize }))} />
          <p className="text-sm text-fg-muted">Pet hair removal, excessive mud / sand and the ceramic coating start at the price shown. Open an add-on for details.</p>
        </section>
        {business.flags.memberships && (
          <section aria-labelledby="p-membership">
            <MembershipCard headingId="p-membership" />
          </section>
        )}

        <section aria-labelledby="p-fees" className="grid gap-5 md:grid-cols-3">
          <h2 id="p-fees" className="sr-only">Fees and policies</h2>
          <div className="card p-6">
            <h3 className="font-bold">Travel fees</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-fg-muted">
              {schedule.zones.map((z) => (
                <li key={z.id}>
                  {z.name}: {z.travelFeeCents ? formatMoney(z.travelFeeCents) : "free"}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="font-bold">Deposit</h3>
            <p className="mt-3 text-sm text-fg-muted">
              {deposit.mode === "none"
                ? "No deposit — pay when the work is done."
                : deposit.mode === "fixed"
                  ? `${formatMoney(deposit.valueCents)} to hold your time, taken off your total.`
                  : `${deposit.percent}% of the total to hold your time, taken off your total.`}
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-bold">Changes & cancellations</h3>
            <p className="mt-3 text-sm text-fg-muted">
              Free changes up to {catalog.cancellation.windowHours} hours before your appointment.{" "}
              <Link href="/cancellation-policy" className="text-gold-300 underline">Full policy</Link>
            </p>
          </div>
        </section>
      </div>
      <FinalCta />
    </PageTransition>
  );
}
