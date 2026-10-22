import { Droplets, MapPin, ShieldCheck } from "lucide-react";
import { business } from "@/config/business";
import { isPlaceholder } from "@/config/placeholder";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { SectionHeading } from "../section-heading";
import { ServiceArt } from "../service-art";

export function WhyUs() {
  const reasons = [
    {
      icon: Droplets,
      title: "Products that protect",
      body: business.proof.productsUsed.join(" · "),
      sample: isPlaceholder("proof.products"),
    },
    {
      icon: MapPin,
      title: "We come to you",
      body: "Fully self-contained vans with water and power — your driveway, office or garage.",
      sample: false,
    },
    { icon: ShieldCheck, title: "Our guarantee", body: business.proof.guarantee, sample: isPlaceholder("proof.guarantee") },
  ];
  return (
    <section aria-labelledby="why-title" className="container-site grid items-center gap-14 py-24 md:py-32 lg:grid-cols-2">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-white/10">
        <div data-parallax="8" className="absolute -inset-y-[10%] inset-x-0">
          <ServiceArt slug="why-us" category="paint-protection" className="size-full" />
        </div>
        <PlaceholderBadge className="absolute bottom-4 left-4" label="Sample image — add a real photo" />
      </div>
      <div className="flex flex-col gap-10">
        <SectionHeading id="why-title" eyebrow="Why choose us" title="Obsessive about the details others skip." />
        <ul className="flex flex-col gap-7">
          {reasons.map((r) => (
            <li key={r.title} className="flex gap-4" data-reveal>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold-500/10 text-gold-300">
                <r.icon className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold">
                  {r.title} {r.sample && <PlaceholderBadge label="Sample" />}
                </h3>
                <p className="mt-1 leading-relaxed text-fg-muted">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
