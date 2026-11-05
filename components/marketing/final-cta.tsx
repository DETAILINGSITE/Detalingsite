import { Phone } from "lucide-react";
import { business } from "@/config/business";
import { CtaLink } from "@/components/ui/cta-link";

export function FinalCta({ title = "Ready for that new‑car feeling?" }: { title?: string }) {
  // Set the last word in the italic serif for the editorial accent.
  const words = title.trim().split(" ");
  const last = words.pop();
  return (
    <section aria-labelledby="cta-title" className="container-site pb-24 md:pb-36">
      <div className="shell" data-depth>
        <div className="core isolate overflow-hidden px-6 py-20 text-center md:px-16 md:py-32">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(43_140_255/0.22),transparent_62%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/2 -z-10 w-1/2 bg-gradient-to-r from-transparent via-gold-200/10 to-transparent motion-safe:animate-[sheen_7s_ease-in-out_infinite]"
          />
          <p className="eyebrow mx-auto" data-reveal="fade">
            Book in minutes<span className="hidden sm:inline"> · 7 days a week</span>
          </p>
          <h2 id="cta-title" data-split className="mx-auto mt-8 max-w-4xl text-[clamp(2.6rem,6.6vw,6rem)] leading-[0.95] font-extrabold tracking-[-0.04em]">
            {words.join(" ")} <span className="serif electric font-normal">{last}</span>
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-lg text-fg-muted md:text-xl" data-reveal>
            Pick a time online in under three minutes, or give us a call.
          </p>
          <div className="mt-11 flex flex-col justify-center gap-3 sm:flex-row" data-reveal>
            <CtaLink href="/book">Book your detail</CtaLink>
            <a
              href={`tel:${business.contact.phone}`}
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-7 font-semibold text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] transition-colors duration-500 hover:bg-white/[0.08]"
            >
              <Phone strokeWidth={1.75} className="size-4" aria-hidden="true" />
              <span className="tabular">{business.contact.phoneDisplay}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
