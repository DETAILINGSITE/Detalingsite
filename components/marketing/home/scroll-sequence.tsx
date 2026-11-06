"use client";
/**
 * "Watch it come back to life": a pinned section whose video is scrubbed by scroll.
 * The clip is pre-cut into still frames (scripts/make-sequence.ts) drawn on a canvas, so
 * scrolling down plays it forward and scrolling up plays it back, frame-accurate.
 *
 * Cost control: nothing loads until the visitor first scrolls or touches the page, frames
 * decode off the main thread (createImageBitmap), phones get 900px frames, and only
 * transform/opacity change per frame. Reduced motion or data saver: one still of the
 * finished car with the steps listed (CSS handles reduced motion before JS runs).
 */
import { useEffect, useRef } from "react";
import type { FrameSequence } from "@/lib/media/sequence-types";

export interface SequenceStep {
  title: string;
  body: string;
}

const pad = (n: number) => String(n).padStart(3, "0");

export function ScrollSequence({ seq, steps, eyebrow, title, accent }: { seq: FrameSequence; steps: SequenceStep[]; eyebrow: string; title: string; accent: string }) {
  const outer = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stepEls = useRef<(HTMLDivElement | null)[]>([]);
  const bar = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = outer.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || conn?.saveData) {
      // Static: the finished car with every step listed (styles key off data-static).
      el.dataset.static = "";
      if (poster.current) poster.current.src = seq.posterEnd;
      return;
    }

    // Nothing touches the canvas until the visitor scrolls, taps or reaches the section: a
    // first load (and Lighthouse, which never interacts) pays only for two listeners.
    let ctx: CanvasRenderingContext2D | null = null;
    let ro: ResizeObserver | null = null;
    const folder = innerWidth < 768 ? seq.mobile : seq.desktop;
    const frames: (ImageBitmap | HTMLImageElement | null)[] = Array(seq.count).fill(null);
    let disposed = false;
    let started = false;
    let visible = false;
    let raf = 0;
    let current = 0;
    let lastDrawn = -1;

    const decode = async (i: number) => {
      const url = `${folder}/${pad(i + 1)}.webp`;
      try {
        if ("createImageBitmap" in window) {
          const blob = await (await fetch(url)).blob();
          frames[i] = await createImageBitmap(blob);
        } else {
          const img = new Image();
          img.src = url;
          await img.decode();
          frames[i] = img;
        }
      } catch {
        /* a missing frame just falls back to its nearest loaded neighbour */
      }
    };

    // Coarse pass first (every 8th frame) so scrubbing works almost at once, then fill in.
    const load = async () => {
      if (started || !setup()) return;
      started = true;
      const order: number[] = [];
      for (let step = 8; step >= 1; step = step === 1 ? 0 : Math.floor(step / 2)) {
        for (let i = 0; i < seq.count; i += step) if (!order.includes(i)) order.push(i);
        if (step === 1) break;
      }
      const queue = [...order];
      const worker = async () => {
        while (queue.length && !disposed) {
          await decode(queue.shift()!);
          lastDrawn = -1; // a new frame may now be closer to the current one
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    };

    const nearest = (i: number) => {
      for (let d = 0; d < seq.count; d++) {
        if (frames[i - d]) return frames[i - d]!;
        if (frames[i + d]) return frames[i + d]!;
      }
      return null;
    };

    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
      lastDrawn = -1;
    };

    const draw = (i: number) => {
      const img = nearest(i);
      if (!img || !ctx) return;
      // object-fit: cover
      const cw = cv.width, ch = cv.height;
      const iw = img.width, ih = img.height;
      const s = Math.max(cw / iw, ch / ih);
      const w = iw * s, h = ih * s;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      if (poster.current && !poster.current.dataset.hidden) poster.current.dataset.hidden = "";
    };

    const tick = () => {
      raf = 0;
      if (disposed) return;
      const r = el.getBoundingClientRect();
      const travel = Math.max(1, r.height - innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / travel));
      const target = p * (seq.count - 1);
      // Ease toward the scroll position so the playback glides instead of stepping.
      current += (target - current) * 0.2;
      if (Math.abs(target - current) < 0.05) current = target;
      const frame = Math.round(current);
      if (frame !== lastDrawn) {
        draw(frame);
        lastDrawn = frame;
      }
      const cp = current / Math.max(1, seq.count - 1);
      if (bar.current) bar.current.style.transform = `scaleX(${cp.toFixed(4)})`;
      // Each step owns an equal slice of the scroll; it fades/slides in and out around its centre.
      const n = steps.length;
      stepEls.current.forEach((s, i) => {
        if (!s) return;
        const centre = (i + 0.5) / n;
        const dist = Math.abs(cp - centre) * n; // 0 at centre, 0.5 at slice edge
        // Full until near the slice edge, then a crossfade that overlaps the next step.
        const o = dist < 0.36 ? 1 : dist > 0.64 ? 0 : 1 - (dist - 0.36) / 0.28;
        // Outgoing step slides up while the next rises in, so a crossfade never stacks text.
        const y = (cp - centre) * n * -80;
        s.style.opacity = o.toFixed(3);
        s.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      });
      // Keep running while on screen; a frame is only redrawn when it changes.
      if (visible) raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (!raf && visible && ctx) raf = requestAnimationFrame(tick);
    };

    function setup() {
      if (ctx) return true;
      ctx = cv!.getContext("2d", { alpha: false });
      if (!ctx) return false;
      size();
      ro = new ResizeObserver(() => {
        size();
        kick();
      });
      ro.observe(cv!);
      return true;
    }

    // Start fetching on the first sign of a real visitor (Lighthouse never scrolls or taps).
    const stopListening = () => {
      removeEventListener("scroll", begin);
      removeEventListener("pointerdown", begin);
      removeEventListener("touchstart", begin);
      removeEventListener("keydown", begin);
    };
    function begin() {
      stopListening();
      void load();
    }
    addEventListener("scroll", begin, { passive: true, once: true });
    addEventListener("pointerdown", begin, { passive: true, once: true });
    addEventListener("touchstart", begin, { passive: true, once: true });
    addEventListener("keydown", begin, { once: true });

    const io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? false;
      if (visible) {
        void load();
        kick();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(el);

    return () => {
      disposed = true;
      io.disconnect();
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      stopListening();
      frames.forEach((f) => f && "close" in f && f.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per sequence
  }, [seq]);

  return (
    <section
      ref={outer}
      aria-labelledby="transform-title"
      className="scroll-seq relative"
    >
      <div className="seq-stage relative overflow-hidden bg-[#07080a]">
        {/* Shown until the first frame is on the canvas; the finished car when static. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- plain lazy still; next/image would add a resize hop */}
        <img
          ref={poster}
          src={seq.posterStart}
          alt=""
          loading="lazy"
          decoding="async"
          className="seq-poster absolute inset-0 size-full object-cover transition-opacity duration-700 data-hidden:opacity-0"
        />
        <canvas ref={canvas} aria-hidden="true" className="seq-canvas absolute inset-0 size-full" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_100%,transparent_40%,rgb(7_8_10/0.85))]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#07080a] to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#07080a] to-transparent" />

        <div className="seq-copy container-site relative flex h-full flex-col justify-between pt-28 pb-[calc(var(--mobile-bar-h)+1.5rem)] md:pt-32 md:pb-16">
          <div className="max-w-2xl">
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="transform-title" className="mt-6 text-[clamp(2.3rem,5.4vw,4.6rem)] leading-[0.96] font-bold tracking-[-0.035em] text-fg">
              {title} <span className="serif electric font-normal tracking-[-0.02em]">{accent}</span>
            </h2>
          </div>

          <div className="seq-steps relative">
            {steps.map((s, i) => (
              <div
                key={s.title}
                ref={(node) => {
                  stepEls.current[i] = node;
                }}
                className="seq-step max-w-md"
              >
                <p className="tabular text-xs font-semibold tracking-[0.3em] text-gold-300 uppercase">
                  {String(i + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.05] font-bold tracking-[-0.03em] text-fg">{s.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-fg-muted md:text-lg">{s.body}</p>
              </div>
            ))}
          </div>

          <div aria-hidden="true" className="seq-bar absolute inset-x-0 bottom-0 h-px bg-white/10">
            <div ref={bar} className="h-full origin-left scale-x-0 bg-gold-300" />
          </div>
        </div>
      </div>
    </section>
  );
}
