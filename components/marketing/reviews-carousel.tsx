"use client";
/** Native scroll-snap carousel with prev/next buttons. No autoplay (WCAG 2.2.2). */
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";

export interface ReviewData {
  id: string;
  authorName: string;
  vehicle: string | null;
  rating: number;
  body: string;
  source: string;
  isPlaceholder: boolean;
}

export function ReviewsCarousel({ reviews }: { reviews: ReviewData[] }) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("li");
    el.scrollBy({ left: dir * ((card?.clientWidth ?? 320) + 20), behavior: "smooth" });
  };
  if (reviews.length === 0) return null;
  return (
    <div className="relative">
      <ul
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] md:mx-0 md:px-0"
        aria-label="Customer reviews"
        tabIndex={0}
      >
        {reviews.map((r) => (
          <li key={r.id} className="card flex w-[85%] shrink-0 snap-start flex-col gap-4 p-6 sm:w-[46%] lg:w-[31.5%]">
            <div className="flex items-center justify-between">
              <span className="flex text-gold-300" role="img" aria-label={`${r.rating} out of 5 stars`}>
                {Array.from({ length: r.rating }, (_, i) => (
                  <Star key={i} className="size-4 fill-current" aria-hidden="true" />
                ))}
              </span>
              {r.isPlaceholder && <PlaceholderBadge label="Sample" />}
            </div>
            <blockquote className="leading-relaxed text-fg">“{r.body}”</blockquote>
            <p className="mt-auto text-sm text-fg-muted">
              <span className="font-semibold text-fg">{r.authorName}</span>
              {r.vehicle ? ` · ${r.vehicle}` : ""} · via {r.source[0]?.toUpperCase() + r.source.slice(1)}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="icon" onClick={() => scroll(-1)} aria-label="Previous reviews">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button variant="secondary" size="icon" onClick={() => scroll(1)} aria-label="Next reviews">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
