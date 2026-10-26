"use client";
/**
 * Before/after comparison. Transform-only (the "after" layer is translated, its image
 * counter-translated) — no clip-path animation. A native range input underneath gives
 * keyboard and screen-reader access; drag works with mouse, pen and touch.
 */
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";

export function BeforeAfter({
  before,
  after,
  altBefore,
  altAfter,
  width,
  height,
  isPlaceholder,
  peek = false,
}: {
  before: string;
  after: string;
  altBefore: string;
  altAfter: string;
  width: number;
  height: number;
  isPlaceholder?: boolean;
  peek?: boolean;
}) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const id = useId();

  // One-time "peek" hint when it scrolls into view (skipped for reduced motion).
  useEffect(() => {
    if (!peek || !box.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        setPos(58);
        setTimeout(() => setPos(50), 600);
      },
      { threshold: 0.6 },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [peek]);

  const fromPointer = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  const unoptimized = before.endsWith(".svg");

  return (
    <figure className="flex flex-col gap-3">
      <div
        ref={box}
        className="relative touch-pan-y overflow-hidden rounded-[var(--radius-card)] border border-white/10 select-none"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <Image src={before} alt={altBefore} fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized={unoptimized} className="object-cover" />
        {/* "After" layer: shifted right by (100 - pos)% and its image shifted back, so only transforms change. */}
        <div
          className="absolute inset-0 overflow-hidden transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${pos}%)` }}
          aria-hidden="false"
        >
          <div className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: `translateX(${-pos}%)` }}>
            <Image src={after} alt={altAfter} fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized={unoptimized} className="object-cover" />
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-0 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${pos}%)` }}
        >
          <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-gold-200">
            <span className="absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-gold-200 bg-ink-900/80 text-xs font-bold text-gold-200 backdrop-blur">
              ⟷
            </span>
          </div>
        </div>
        <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-ink-900/75 px-2.5 py-1 text-xs font-semibold">Before</span>
        <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-ink-900/75 px-2.5 py-1 text-xs font-semibold">After</span>
        {isPlaceholder && <PlaceholderBadge className="absolute top-14 left-3" />}
      </div>
      <label htmlFor={id} className="sr-only">
        Compare before and after
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-[var(--brand)]"
        aria-valuetext={`${Math.round(100 - pos)}% after shown`}
      />
    </figure>
  );
}
