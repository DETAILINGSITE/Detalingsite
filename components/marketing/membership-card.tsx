import { Check } from "lucide-react";
import Link from "next/link";
import { business } from "@/config/business";
import { buttonVariants } from "@/components/ui/button";

/** The VIP maintenance membership offer. Rendered on the home and pricing pages. */
export function MembershipCard({ headingId }: { headingId: string }) {
  const m = business.membership;
  return (
    <div className="card flex flex-col gap-8 p-8 md:flex-row md:items-center md:justify-between md:p-12">
      <div>
        <p className="eyebrow">Maintenance plans</p>
        <h2 id={headingId} className="mt-2 text-3xl font-bold">
          {m.name}
        </h2>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="tabular font-display text-4xl font-bold">{m.priceLabel}</span>
          <span className="text-fg-muted">{m.period}</span>
        </p>
        <ul className="mt-5 flex max-w-xl flex-col gap-2.5 text-sm">
          {m.perks.map((perk) => (
            <li key={perk} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden="true" />
              <span>{perk}</span>
            </li>
          ))}
        </ul>
      </div>
      <Link href="/contact?topic=membership" className={buttonVariants()}>
        Ask about memberships
      </Link>
    </div>
  );
}
