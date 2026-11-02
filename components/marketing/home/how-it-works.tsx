import { CalendarCheck, Car, ClipboardList, Sparkles } from "lucide-react";
import { SectionHeading } from "../section-heading";

const STEPS = [
  { icon: ClipboardList, title: "Pick your package", body: "Choose Bronze, Silver, Gold or VIP, plus any add-ons. Prices update live for your vehicle size." },
  { icon: CalendarCheck, title: "Choose a time", body: "See real availability and pick the slot that suits you." },
  { icon: Car, title: "We come to you", body: "We bring water, power and equipment to your driveway, office or garage." },
  { icon: Sparkles, title: "Drive away gleaming", body: "Pay the balance when you're happy. Not happy? We come back." },
];

/** Desktop: short pinned sequence with a scrubbed progress line. Mobile: simple reveals. */
export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="bg-ink-850 py-24 md:py-32" data-pin-steps>
      <div className="container-site">
        <SectionHeading id="how-title" eyebrow="How it works" title="Booked in minutes. Done right." align="center" />
        <div className="relative mt-16">
          <div aria-hidden="true" className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-white/10 lg:block">
            <div data-progress-line className="h-full origin-left bg-gradient-to-r from-gold-500 to-gold-200" />
          </div>
          <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} data-step className="flex flex-col items-center gap-4 text-center">
                <span className="relative flex size-14 items-center justify-center rounded-full border border-gold-400/40 bg-ink-900 text-gold-300">
                  <s.icon className="size-6" aria-hidden="true" />
                  <span className="sr-only">Step {i + 1}: </span>
                </span>
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="max-w-xs text-sm leading-relaxed text-fg-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
