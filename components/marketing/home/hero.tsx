import { Star } from "lucide-react";
import { business } from "@/config/business";
import { CtaLink } from "@/components/ui/cta-link";
import { HeroStage } from "./hero-stage";

/**
 * Hero (docs/PLAN.md §6, Home 1). The headline is the LCP element; the procedural 3D paint scene
 * loads lazily behind it and fades in when its first frame is ready. There is no still
 * placeholder: devices that skip 3D just get the dark backdrop. The headline animates with a transform-only CSS keyframe so it paints on frame 1.
 * On desktop the hero is pinned for a short scroll so the paint is polished (dull → gloss, with a
 * gloss meter) while the copy recedes.
 */
export function Hero() {
  const rating = business.proof.rating;
  return (
    <section aria-labelledby="hero-title" className="relative isolate md:h-[175vh]" data-hero>
      <div className="relative overflow-hidden md:sticky md:top-0 md:h-[100svh]" data-hero-pin>
        <div className="absolute inset-x-0 bottom-0 -z-10 h-[340px] md:inset-0 md:h-auto">
          <HeroStage />
          <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,#07080a_0%,rgb(7_8_10/0.85)_32%,transparent_62%)] md:block" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#07080a] to-transparent md:hidden" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#07080a]" />
        </div>

        <div className="container-site flex flex-col pt-10 pb-[360px] md:h-full md:justify-center md:pt-[var(--header-h)] md:pb-0" data-hero-content>
          <p className="eyebrow animate-rise">Mobile detailing · Houston<span className="hidden sm:inline"> · 7 days a week</span></p>
          <h1
            id="hero-title"
            className="mt-7 max-w-[15ch] animate-rise text-[clamp(2.6rem,8vw,7.4rem)] leading-[0.9] font-extrabold tracking-[-0.035em] text-fg [animation-delay:60ms]"
          >
            Showroom finish,{" "}
            <span className="serif electric pr-[0.08em] text-[1.08em] leading-[0.85] font-normal tracking-[-0.02em]">wherever you park.</span>
          </h1>
          <p className="mt-7 max-w-[34rem] animate-rise text-lg leading-relaxed text-fg-muted [animation-delay:120ms] md:text-xl">
            Hand-finished paint, glass and interiors — done in your driveway with our own water and power. Book online in minutes.
          </p>
          <div className="mt-10 flex animate-rise flex-col gap-3 [animation-delay:180ms] sm:flex-row sm:flex-wrap sm:items-center">
            <CtaLink href="/book" className="w-full sm:w-auto">
              Book your detail
            </CtaLink>
            <CtaLink href="/quote" variant="glass" className="w-full sm:w-auto">
              Get a custom quote
            </CtaLink>
          </div>

          <dl className="mt-12 grid max-w-xl animate-rise grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/[0.06] [animation-delay:240ms]">
            {[
              { k: "Packages from", v: "$75" },
              { k: "Open", v: "7 days" },
              { k: "Service", v: "100% mobile" },
            ].map((s) => (
              <div key={s.k} className="min-w-0 bg-[#0a0c0f]/80 px-3 py-3.5 sm:px-4 md:px-5">
                <dt className="text-[0.6rem] font-semibold tracking-[0.1em] text-fg-subtle uppercase sm:text-[0.66rem] sm:tracking-[0.18em]">{s.k}</dt>
                <dd className="tabular mt-1 font-display text-base font-bold text-fg sm:text-lg md:text-xl">{s.v}</dd>
              </div>
            ))}
          </dl>

          {/* Only shown once the rating is a real, verified Google rating (proof.rating.isReal). */}
          {rating.isReal && (
            <a
              href={business.links.googleReviews.replace(/\/review$/, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-fit max-w-full animate-rise items-center gap-3 rounded-full border border-white/10 bg-ink-900/60 py-2 pr-4 pl-3 [animation-delay:300ms]"
            >
              <span className="flex text-gold-300" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </span>
              <span className="tabular text-sm text-fg">
                <strong>{rating.value.toFixed(1)}</strong> on Google · {rating.count} reviews
              </span>
            </a>
          )}
        </div>

        {/* Gloss meter: filled by the 3D scene as scroll polishes the paint (paint-canvas.tsx). */}
        <div aria-hidden="true" className="polish-meter pointer-events-none absolute bottom-[352px] left-5 flex items-center gap-3 text-[0.66rem] font-semibold tracking-[0.3em] text-fg-subtle uppercase md:right-8 md:bottom-20 md:left-auto">
          Gloss
          <span className="relative h-px w-16 overflow-hidden bg-white/15">
            <span data-polish-fill className="absolute inset-0 origin-left scale-x-0 bg-gold-300" />
          </span>
          <span className="tabular w-[3ch] text-fg"><span data-polish-pct>00</span>%</span>
        </div>

        <div aria-hidden="true" data-hero-content className="pointer-events-none absolute right-8 bottom-10 hidden items-center gap-4 text-[0.66rem] font-semibold tracking-[0.3em] text-fg-subtle uppercase md:flex">
          Scroll
          <span className="relative h-px w-16 overflow-hidden bg-white/15">
            <span className="absolute inset-y-0 left-0 w-1/2 animate-[marquee_2.4s_cubic-bezier(0.32,0.72,0,1)_infinite] bg-gold-300" />
          </span>
        </div>
      </div>
    </section>
  );
}
