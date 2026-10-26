import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { business } from "@/config/business";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroStage } from "./hero-stage";

/**
 * Hero (docs/PLAN.md §6, Home 1). The poster <Image priority> is the LCP element; the
 * 3D stage loads lazily on top of it and cross-fades in when its first frame is ready.
 * The headline animates with a transform-only CSS keyframe so it paints on frame 1.
 */
export function Hero() {
  const rating = business.proof.rating;
  return (
    <section aria-labelledby="hero-title" className="relative isolate md:h-[220vh] motion-reduce:md:h-auto" data-hero>
      <div className="relative overflow-hidden md:sticky md:top-0 md:h-[100svh]" data-hero-pin>
        {/* Phones: the car sits in a band under the text so it never runs through the copy. */}
        <div className="absolute inset-x-0 bottom-0 -z-10 h-[250px] md:inset-0 md:h-auto">
          <Image
            src="/images/hero-poster.svg"
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            unoptimized
            className="object-cover object-[50%_70%]"
          />
          <HeroStage />
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-ink-900/85 via-ink-900/40 to-transparent md:block" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-ink-900 to-transparent md:hidden" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_30%,rgb(11_12_14/0.65)_75%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-900" />
        </div>

        <div className="container-site flex flex-col justify-start pt-6 pb-[270px] md:h-full md:pt-[8vh] md:pb-0">
          <p className="eyebrow animate-rise">Mobile auto detailing · Houston, TX</p>
          <h1
            id="hero-title"
            className="mt-5 max-w-4xl animate-rise text-[clamp(2.6rem,7.4vw,6.2rem)] leading-[0.95] font-extrabold text-fg [animation-delay:60ms]"
          >
            Showroom finish.
            <br />
            <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent">
              Wherever you park.
            </span>
          </h1>
          <p className="mt-6 max-w-xl animate-rise text-lg leading-relaxed text-fg-muted [animation-delay:120ms] md:text-xl">
            From a maintenance wash to a full showroom finish, we come to you across Houston. Book online in minutes.
          </p>
          <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:180ms] sm:flex-row sm:flex-wrap sm:items-center md:mt-9">
            <Link href="/book" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
              Book Your Detail
            </Link>
            <Link href="/quote" className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "w-full sm:w-auto")}>
              Get a Custom Quote
            </Link>
          </div>
          {/* Only shown once the rating is a real, verified Google rating (proof.rating.isReal). */}
          {rating.isReal && (
          <a
            href={business.links.googleReviews.replace(/\/review$/, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-fit max-w-full animate-rise items-center gap-3 md:mt-8 rounded-full border border-white/10 bg-ink-900/60 py-2 pr-4 pl-3 backdrop-blur-md [animation-delay:240ms]"
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
      </div>
      <p className={cn("sr-only")}>Scroll to explore our services.</p>
    </section>
  );
}
