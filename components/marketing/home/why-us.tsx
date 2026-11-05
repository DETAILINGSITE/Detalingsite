import { Droplets, MapPin, ShieldCheck } from "lucide-react";
import { business } from "@/config/business";

/** Manifesto (words light up on scroll) followed by an asymmetric bento of tilting glass cards. */
export function WhyUs() {
  return (
    <section aria-labelledby="why-title" className="container-site section-pad">
      <p className="eyebrow" data-reveal="fade">
        Why choose us
      </p>
      <h2 id="why-title" className="sr-only">
        Obsessive about the details others skip
      </h2>
      <p
        data-scrub-text
        className="mt-8 max-w-[22ch] text-[clamp(2.1rem,5.2vw,4.6rem)] leading-[1.02] font-bold tracking-[-0.035em] text-fg md:max-w-[24ch]"
      >
        We&apos;re obsessive about the details others skip — the door jambs, the wheel barrels, the{" "}
        <span className="serif electric font-normal">last streak</span> on the glass.
      </p>

      <ul className="mt-16 grid gap-5 md:mt-24 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-2" data-fan>
        <li className="shell md:col-span-2 lg:col-span-7 lg:row-span-2" data-fan-item>
          <div className="core flex h-full flex-col justify-between gap-10 p-8 md:p-11 lg:min-h-[22rem]" data-tilt="4">
            <Spotlight />
            <span className="flex size-14 items-center justify-center rounded-2xl border border-gold-400/25 bg-gold-500/10 text-gold-300">
              <ShieldCheck strokeWidth={1.5} className="size-7" aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">Our guarantee</p>
              <h3 className="mt-5 text-[clamp(1.8rem,3.2vw,2.8rem)] leading-[1.02] font-bold tracking-[-0.03em]">
                Not happy? <span className="serif electric font-normal">We come back.</span>
              </h3>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-fg-muted">{business.proof.guarantee}</p>
            </div>
          </div>
        </li>
        <li className="shell lg:col-span-5" data-fan-item>
          <div className="core flex h-full flex-col gap-4 p-8" data-tilt="6">
            <Spotlight />
            <Droplets strokeWidth={1.5} className="size-8 text-gold-300" aria-hidden="true" />
            <h3 className="text-2xl font-bold tracking-[-0.02em]">Professional-quality products</h3>
            <p className="leading-relaxed text-fg-muted">The right products on every vehicle, from a routine maintenance wash to a full showroom finish.</p>
          </div>
        </li>
        <li className="shell lg:col-span-5" data-fan-item>
          <div className="core flex h-full flex-col gap-4 p-8" data-tilt="6">
            <Spotlight />
            <MapPin strokeWidth={1.5} className="size-8 text-gold-300" aria-hidden="true" />
            <h3 className="text-2xl font-bold tracking-[-0.02em]">We come to you</h3>
            <p className="leading-relaxed text-fg-muted">100% mobile. We bring our own water, power and equipment to your driveway, office or garage.</p>
          </div>
        </li>
      </ul>
    </section>
  );
}

/** Soft light that follows the pointer across a tilt card (driven by --mx/--my from the engine). */
function Spotlight() {
  return (
    <span
      aria-hidden="true"
      className="spot"
    />
  );
}
