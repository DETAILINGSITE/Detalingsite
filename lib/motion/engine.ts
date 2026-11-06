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
 *   data-depth             3D entry: tilts up out of depth as it scrolls in (scrubbed)
 *   data-recede            section sinks back and fades as it scrolls out of view
 *   data-fan / data-fan-item  children fan in from alternating 3D angles
 *   data-tilt              pointer-driven 3D tilt + light position (fine pointers only)
 *   data-stack / data-stack-card  sticky cards; each one recedes as the next arrives
 *   data-scrub-text        words brighten one by one as the paragraph scrolls through
 *   data-magnetic          button eases toward the cursor (fine pointers only)
 *   data-hero-content      hero copy drifts back into depth as you scroll away
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

/** Tilt + magnetic hover. Fine pointers with motion allowed only; touch devices skip it entirely. */
function initPointer(root: HTMLElement): () => void {
  if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return () => {};
  const offs: (() => void)[] = [];
  const bind = (el: HTMLElement, move: (e: PointerEvent) => void, leave: () => void) => {
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    offs.push(() => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    });
  };

  root.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
    const max = Number(el.dataset.tilt || 6);
    gsap.set(el, { transformPerspective: 1000 });
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3.out" });
    bind(
      el,
      (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * max * 2);
        rx((0.5 - py) * max * 2);
        el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      },
      () => {
        rx(0);
        ry(0);
      },
    );
  });

  root.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    bind(
      el,
      (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.22);
        y((e.clientY - (r.top + r.height / 2)) * 0.3);
      },
      () => {
        x(0);
        y(0);
      },
    );
  });

  return () => offs.forEach((off) => off());
}

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
      // Anything already on screen (or scrolled past) when motion starts stays as it is:
      // the engine can boot late, and hiding visible content to re-reveal it would flash.
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]:not([data-revealed])", root).filter((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.88) {
          el.dataset.revealed = "";
          return false;
        }
        return true;
      });

      if (reduced) {
        if (reveals.length) gsap.set(reveals, { opacity: 1, y: 0, clearProps: "transform" });
        return;
      }

      // Reveals
      const offset = desktop ? 24 : 12;
      const lifted = reveals.filter((el) => el.dataset.reveal !== "fade");
      // GSAP warns ("target not found") on an empty list, e.g. a page whose reveals are all above the fold.
      if (lifted.length) gsap.set(lifted, { y: offset });
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

      // ── 3D depth entries (scrubbed both ways, so scrolling back up reverses them) ──
      const depth = desktop ? { y: 70, z: -160, rotationX: 14 } : { y: 36, z: -60, rotationX: 7 };
      gsap.utils.toArray<HTMLElement>("[data-depth]", root).forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
          el.dataset.revealed = "";
          return;
        }
        gsap.fromTo(
          el,
          { opacity: 0, ...depth, transformPerspective: 1400, transformOrigin: "50% 100%" },
          safeVars({
            opacity: 1,
            y: 0,
            z: 0,
            rotationX: 0,
            ease: "power2.out",
            immediateRender: true,
            scrollTrigger: { trigger: el, start: "top 96%", end: "top 58%", scrub: 0.9 },
          }),
        );
        el.dataset.revealed = "";
      });

      // ── Sections recede into the distance as they scroll out the top ──
      gsap.utils.toArray<HTMLElement>("[data-recede]", root).forEach((el) => {
        gsap.to(
          el,
          safeVars({
            opacity: 0.25,
            scale: desktop ? 0.94 : 0.97,
            rotationX: desktop ? -7 : 0,
            transformPerspective: 1600,
            transformOrigin: "50% 0%",
            ease: "none",
            scrollTrigger: { trigger: el, start: "bottom 70%", end: "bottom 5%", scrub: true },
          }),
        );
      });

      // ── Card groups fan in from alternating angles ──
      gsap.utils.toArray<HTMLElement>("[data-fan]", root).forEach((group) => {
        const items = gsap.utils.toArray<HTMLElement>("[data-fan-item]", group);
        if (!items.length || group.getBoundingClientRect().top < window.innerHeight * 0.85) return;
        gsap.fromTo(
          items,
          {
            opacity: 0,
            y: desktop ? 90 : 40,
            z: desktop ? -220 : -80,
            rotationY: (i: number) => (desktop ? (i % 2 ? -16 : 16) : 0),
            rotationX: desktop ? 12 : 6,
            transformPerspective: 1200,
          },
          safeVars({
            opacity: 1,
            y: 0,
            z: 0,
            rotationY: 0,
            rotationX: 0,
            ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: { trigger: group, start: "top 92%", end: "top 40%", scrub: 1 },
          }),
        );
      });

      // ── Sticky stacking cards: each recedes as the next one slides over it ──
      gsap.utils.toArray<HTMLElement>("[data-stack]", root).forEach((stack) => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]", stack);
        cards.forEach((card, i) => {
          const next = cards[i + 1];
          if (!next) return;
          gsap.to(
            card,
            safeVars({
              scale: 0.9,
              opacity: 0.35,
              rotationX: desktop ? 10 : 4,
              transformPerspective: 1400,
              transformOrigin: "50% 0%",
              ease: "none",
              scrollTrigger: { trigger: next, start: "top 85%", end: "top 20%", scrub: true },
            }),
          );
        });
      });

      // ── Words brighten as the paragraph scrolls through ──
      gsap.utils.toArray<HTMLElement>("[data-scrub-text]", root).forEach((el) => {
        SplitText.create(el, {
          type: "words",
          autoSplit: true,
          // The words stay real text in reading order: "auto" would put aria-label on the <p>,
          // which ARIA doesn't allow on a paragraph.
          aria: "none",
          onSplit: (self) =>
            gsap.fromTo(
              self.words,
              // Dim, not invisible: 0.4 keeps large bold text above 3:1 contrast before it lights up.
              { opacity: 0.4 },
              safeVars({ opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true } }),
            ),
        });
      });

      // ── Hero copy drifts back into depth as you scroll away ──
      gsap.utils.toArray<HTMLElement>("[data-hero-content]", root).forEach((el) => {
        const hero = el.closest<HTMLElement>("[data-hero]") ?? el;
        gsap.to(
          el,
          safeVars({
            opacity: 0,
            y: desktop ? -60 : -30,
            z: desktop ? -260 : -80,
            rotationX: desktop ? 10 : 0,
            transformPerspective: 1400,
            ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: desktop ? "40% top" : "bottom top", scrub: true },
          }),
        );
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
    const pointerCleanup = initPointer(root);
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => {
      pointerCleanup();
      mm.revert();
    };
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
