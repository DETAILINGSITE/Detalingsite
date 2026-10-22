/**
 * Motion engine — dynamically imported AFTER hydration + idle so GSAP/Lenis are never
 * part of the initial JS (docs/PLAN.md §7). Sections opt in declaratively:
 *
 *   data-reveal            fade/slide in on enter (batched)
 *   data-reveal="fade"     opacity only
 *   data-split             SplitText line-mask reveal for headlines
 *   data-parallax="8"      yPercent parallax (desktop only)
 *   data-count="1500"      count-up (final value is server-rendered)
 *   data-pin-steps         short pinned "how it works" sequence (desktop only)
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { safeVars } from "./guard";

gsap.registerPlugin(ScrollTrigger, SplitText);

export interface MotionHandle {
  lenis: Lenis | null;
  initPage: (root: HTMLElement) => () => void;
  scrollTop: () => void;
  destroy: () => void;
}

const QUERIES = {
  desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
  mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
};

export function startMotion(): MotionHandle {
  const reduce = window.matchMedia(QUERIES.reduce).matches;
  const html = document.documentElement;

  // Lenis smooths wheel scrolling only; touch stays native (syncTouch: false).
  let lenis: Lenis | null = null;
  let tick: ((t: number) => void) | null = null;
  if (!reduce) {
    lenis = new Lenis({ autoRaf: false, syncTouch: false, anchors: true, lerp: 0.1 });
    lenis.on("scroll", ScrollTrigger.update);
    tick = (t: number) => lenis?.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }
  html.classList.add("motion-ready");
  (window as unknown as { __motion?: unknown }).__motion = { gsap, ScrollTrigger, lenis };

  function initPage(root: HTMLElement) {
    const mm = gsap.matchMedia(root);
    mm.add(QUERIES, (ctx) => {
      const { desktop, reduce: reduced } = ctx.conditions as Record<keyof typeof QUERIES, boolean>;
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]", root);

      if (reduced) {
        gsap.set(reveals, { opacity: 1, y: 0, clearProps: "transform" });
        return;
      }

      // Reveals
      const offset = desktop ? 24 : 12;
      gsap.set(reveals.filter((el) => el.dataset.reveal !== "fade"), { y: offset });
      ScrollTrigger.batch(reveals, {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, safeVars({ opacity: 1, y: 0, duration: desktop ? 0.9 : 0.6, ease: "expo.out", stagger: 0.08, overwrite: true })),
      });

      // Headline line reveals
      gsap.utils.toArray<HTMLElement>("[data-split]", root).forEach((el) => {
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(
              self.lines,
              safeVars({
                yPercent: 105,
                duration: 1,
                ease: "expo.out",
                stagger: 0.08,
                scrollTrigger: { trigger: el, start: "top 85%", once: true },
              }),
            ),
        });
      });

      // Count-up (value is already correct in the HTML; animate from 0 on enter)
      gsap.utils.toArray<HTMLElement>("[data-count]", root).forEach((el) => {
        const target = Number(el.dataset.count ?? 0);
        const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: Number(el.dataset.decimals ?? 0) });
        const state = { v: 0 };
        ScrollTrigger.create({
          trigger: el,
          start: "top 90%",
          once: true,
          onEnter: () => {
            el.textContent = fmt.format(0);
            gsap.to(state, {
              v: target,
              duration: 1.6,
              ease: "power3.out",
              onUpdate: () => {
                el.textContent = fmt.format(state.v);
              },
            });
          },
        });
      });

      if (desktop) {
        gsap.utils.toArray<HTMLElement>("[data-parallax]", root).forEach((el) => {
          const amount = Number(el.dataset.parallax ?? 8);
          gsap.fromTo(
            el,
            { yPercent: -amount },
            safeVars({
              yPercent: amount,
              ease: "none",
              scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true },
            }),
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-pin-steps]", root).forEach((section) => {
          const line = section.querySelector<HTMLElement>("[data-progress-line]");
          const steps = gsap.utils.toArray<HTMLElement>("[data-step]", section);
          const tl = gsap.timeline({
            scrollTrigger: { trigger: section, start: "top top+=96", end: "+=70%", pin: true, scrub: 0.6 },
          });
          if (line) tl.fromTo(line, { scaleX: 0 }, safeVars({ scaleX: 1, ease: "none", duration: steps.length }), 0);
          steps.forEach((step, i) => tl.fromTo(step, { opacity: 0.25, y: 16 }, safeVars({ opacity: 1, y: 0, duration: 0.6 }), i * 0.9));
        });
      } else {
        gsap.utils.toArray<HTMLElement>("[data-progress-line]", root).forEach((line) =>
          gsap.fromTo(line, { scaleX: 0 }, safeVars({ scaleX: 1, ease: "none", scrollTrigger: { trigger: line, start: "top 85%", end: "top 40%", scrub: true } })),
        );
      }
    });
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => mm.revert();
  }

  return {
    lenis,
    initPage,
    scrollTop: () => {
      if (lenis) lenis.scrollTo(0, { immediate: true });
      else window.scrollTo(0, 0);
    },
    destroy: () => {
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      html.classList.remove("motion-ready");
    },
  };
}
