import { Phone } from "lucide-react";
import Link from "next/link";
import { business } from "@/config/business";
import { buttonVariants } from "@/components/ui/button";

export function FinalCta({ title = "Ready for that new-car feeling?" }: { title?: string }) {
  return (
    <section aria-labelledby="cta-title" className="container-site pb-24 md:pb-32">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-gold-400/30 bg-gradient-to-br from-ink-800 via-ink-850 to-ink-900 px-6 py-16 text-center md:px-16 md:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/2 -z-10 w-1/2 bg-gradient-to-r from-transparent via-gold-200/10 to-transparent motion-safe:animate-[sheen_6s_ease-in-out_infinite]"
        />
        <h2 id="cta-title" data-split className="mx-auto max-w-3xl text-[clamp(2rem,4.6vw,3.8rem)] leading-[1.02] font-bold">
          {title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-fg-muted" data-reveal>
          Pick a time online in under three minutes, or give us a call.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3" data-reveal>
          <Link href="/book" className={buttonVariants({ size: "lg" })}>
            Book Your Detail
          </Link>
          <a href={`tel:${business.contact.phone}`} className={buttonVariants({ size: "lg", variant: "secondary" })}>
            <Phone aria-hidden="true" /> {business.contact.phoneDisplay}
          </a>
        </div>
      </div>
    </section>
  );
}
