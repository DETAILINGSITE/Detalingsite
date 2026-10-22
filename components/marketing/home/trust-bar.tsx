import { BadgeCheck, ShieldCheck, Sparkles, Star } from "lucide-react";
import { business } from "@/config/business";
import { isPlaceholder } from "@/config/placeholder";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";

export function TrustBar() {
  const p = business.proof;
  const sample = isPlaceholder("proof.rating") || isPlaceholder("proof.carsDetailed");
  const items = [
    { icon: Star, value: p.rating.value, decimals: 1, label: `Google rating · ${p.rating.count} reviews` },
    { icon: Sparkles, value: p.carsDetailed, decimals: 0, suffix: "+", label: "Cars detailed" },
    { icon: ShieldCheck, text: p.insured ? "Fully insured" : "Licensed", label: "Peace of mind on every job" },
    { icon: BadgeCheck, text: "Satisfaction", label: "Guaranteed — or we come back" },
  ];
  return (
    <section aria-label="Why customers trust us" className="relative border-y border-white/[0.06] bg-ink-850">
      <div className="container-site py-8">
        {sample && <PlaceholderBadge className="mb-4" />}
        <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {items.map((it) => (
            <li key={it.label} className="flex items-center gap-4" data-reveal>
              <it.icon className="size-7 shrink-0 text-gold-300" aria-hidden="true" />
              <div>
                <p className="font-display text-2xl font-bold text-fg">
                  {"value" in it && it.value !== undefined ? (
                    <>
                      <span className="tabular inline-block min-w-[3ch]" data-count={it.value} data-decimals={it.decimals}>
                        {it.value.toLocaleString("en-US", { maximumFractionDigits: it.decimals, minimumFractionDigits: it.decimals })}
                      </span>
                      {it.suffix}
                    </>
                  ) : (
                    it.text
                  )}
                </p>
                <p className="text-sm text-fg-muted">{it.label}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
