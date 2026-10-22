import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { business } from "@/config/business";
import { buttonVariants } from "@/components/ui/button";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { isPlaceholder } from "@/config/placeholder";
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
      <div className="relative min-h-[88svh] overflow-hidden md:sticky md:top-0 md:h-[100svh] md:min-h-0" data-hero-pin>
        <div className="absolute inset-0 -z-10">
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
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_30%,rgb(11_12_14/0.65)_75%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-900" />
        </div>

        <div className="container-site flex min-h-[88svh] flex-col justify-start pt-[12vh] md:min-h-0 md:h-full md:pt-[16vh]">
          <p className="eyebrow animate-rise">Mobile &amp; in-shop detailing</p>
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
            Paint correction, ceramic coatings and deep interior detailing — booked online in minutes, done to an obsessive standard.
          </p>
          <div className="mt-9 flex animate-rise flex-wrap items-center gap-3 [animation-delay:180ms]">
            <Link href="/book" className={buttonVariants({ size: "lg" })}>
              Book Your Detail
            </Link>
            <Link href="/quote" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Get a Custom Quote
            </Link>
          </div>
          <a
            href={business.links.googleReviews.replace(/\/review$/, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex w-fit animate-rise items-center gap-3 rounded-full border border-white/10 bg-ink-900/60 py-2 pr-4 pl-3 backdrop-blur-md [animation-delay:240ms]"
          >
            <span className="flex text-gold-300" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="size-4 fill-current" />
              ))}
            </span>
            <span className="tabular text-sm text-fg">
              <strong>{rating.value.toFixed(1)}</strong> on Google · {rating.count} reviews
            </span>
            {isPlaceholder("proof.rating") && <PlaceholderBadge label="Sample" />}
          </a>
        </div>
      </div>
      <p className={cn("sr-only")}>Scroll to explore our services.</p>
    </section>
  );
}
