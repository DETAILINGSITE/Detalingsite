import { CalendarCheck, Car, ClipboardList, Sparkles } from "lucide-react";
import { SectionHeading } from "../section-heading";

const STEPS = [
  { icon: ClipboardList, title: "Pick your package", body: "Choose Bronze, Silver, Gold or VIP, plus any add-ons. Prices update live for your vehicle size." },
  { icon: CalendarCheck, title: "Choose a time", body: "See real availability, seven days a week, and pick the slot that suits you." },
  { icon: Car, title: "We come to you", body: "We bring water, power and equipment to your driveway, office or garage." },
  { icon: Sparkles, title: "Drive away gleaming", body: "Pay the balance when you're happy. Not happy? We come back." },
];

/**
 * Sticky stacking cards: the heading stays put while each step slides over the last, which
 * tilts back and dims into the stack (data-stack). Plain stacked cards without motion.
 */
export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="relative section-pad">
      <div className="container-site grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+4rem)] lg:self-start">
          <SectionHeading id="how-title" eyebrow="How it works" title="Booked in minutes." accent="Done right." />
          <p className="mt-6 max-w-md text-fg-muted" data-reveal>
            Four steps from your phone to a finish you can see your reflection in.
          </p>
        </div>
        <ol className="flex flex-col gap-6" data-stack>
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              data-stack-card
              className="shell sticky"
              style={{ top: `calc(var(--header-h) + 2rem + ${i * 1.25}rem)` }}
            >
              <div className="core flex min-h-[17rem] flex-col justify-between gap-8 p-8 md:min-h-[19rem] md:p-10">
                <div className="flex items-start justify-between gap-6">
                  <span className="chrome font-display text-[clamp(3.6rem,7vw,5.6rem)] leading-[0.8] font-extrabold tracking-[-0.05em]" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <span className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-gold-300">
                    <s.icon strokeWidth={1.5} className="size-5" aria-hidden="true" />
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-[-0.02em] md:text-3xl">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="mt-3 max-w-md leading-relaxed text-fg-muted">{s.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
