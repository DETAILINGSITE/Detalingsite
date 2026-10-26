import { Droplets, MapPin, ShieldCheck } from "lucide-react";
import { business } from "@/config/business";
import { SectionHeading } from "../section-heading";

export function WhyUs() {
  const reasons = [
    {
      icon: Droplets,
      title: "Professional-quality products",
      body: "The right products on every vehicle, from a routine maintenance wash to a full showroom finish.",
    },
    {
      icon: MapPin,
      title: "We come to you",
      body: "100% mobile. We bring our own water, power and equipment to your driveway, office or garage.",
    },
    { icon: ShieldCheck, title: "Our guarantee", body: business.proof.guarantee },
  ];
  return (
    <section aria-labelledby="why-title" className="container-site py-24 md:py-32">
      <SectionHeading id="why-title" eyebrow="Why choose us" title="Obsessive about the details others skip." align="center" />
      <ul className="mt-12 grid gap-5 md:grid-cols-3">
        {reasons.map((r) => (
          <li key={r.title} className="card flex flex-col gap-4 p-7" data-reveal>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gold-500/10 text-gold-300">
              <r.icon className="size-6" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-bold">{r.title}</h3>
            <p className="leading-relaxed text-fg-muted">{r.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
