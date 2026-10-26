import { MapPin, ShieldCheck, Sparkles } from "lucide-react";

/** The three promises from the price flyer. */
const ITEMS = [
  { icon: Sparkles, title: "Professional", label: "Quality products on every job" },
  { icon: MapPin, title: "100% mobile", label: "We come to you" },
  { icon: ShieldCheck, title: "Satisfaction guaranteed", label: "Backed by our guarantee" },
];

export function TrustBar() {
  return (
    <section aria-label="Why customers trust us" className="relative border-y border-white/[0.06] bg-ink-850">
      <div className="container-site py-8">
        <ul className="grid gap-6 sm:grid-cols-3">
          {ITEMS.map((it) => (
            <li key={it.title} className="flex min-w-0 items-center gap-4" data-reveal>
              <it.icon className="size-7 shrink-0 text-gold-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-display text-xl font-bold text-fg">{it.title}</p>
                <p className="text-sm text-fg-muted">{it.label}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
