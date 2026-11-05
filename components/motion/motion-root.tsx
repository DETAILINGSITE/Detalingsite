"use client";
/**
 * Boots the motion engine on the first scroll/touch/key/pointer, or (desktop only) after a few
 * idle seconds, so GSAP/Lenis (~50 KB gz) never compete with first paint or LCP. Content is fully visible
 * without it; it only adds reveals for what's still below the fold. Re-inits per navigation.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { captureAttribution } from "@/lib/analytics/track";
import type { MotionHandle } from "@/lib/motion/engine";

/** Gives the browser a chance to run input and paint before the next chunk of work. */
function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function MotionRoot({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MotionHandle | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
    let cancelled = false;
    // Loading the engine, starting it and wiring the page's triggers each take a slice of main
    // thread on a slow phone. Yielding between them keeps each one short instead of a single
    // long task (Total Blocking Time).
    const boot = async () => {
      try {
        const { startMotion } = await import("@/lib/motion/engine");
        await yieldToMain();
        if (cancelled || !rootRef.current) return;
        const handle = startMotion();
        handleRef.current = handle;
        await yieldToMain();
        if (cancelled || !rootRef.current || handleRef.current !== handle) return;
        cleanupRef.current = handle.initPage(rootRef.current);
      } catch (err) {
        console.warn("[motion] disabled:", err);
      }
    };
    const EVENTS = ["scroll", "wheel", "touchstart", "pointerdown", "keydown"] as const;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      for (const e of EVENTS) window.removeEventListener(e, start);
      clearTimeout(timer);
      void boot();
    };
    for (const e of EVENTS) window.addEventListener(e, start, { passive: true, once: true });
    // Desktop also boots on idle. Phones wait for the first touch or scroll: evaluating GSAP/Lenis
    // is a few hundred ms of main thread on a mid-range phone, and nothing on screen needs it yet
    // (anything already visible when the engine starts is left as is). Same policy as HeroStage.
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const timer = mobile
      ? undefined
      : window.setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2000 }) : start()), 3500);
    return () => {
      cancelled = true;
      for (const e of EVENTS) window.removeEventListener(e, start);
      clearTimeout(timer);
      cleanupRef.current?.();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  // Re-run section motion after client navigations (layouts persist; pages don't).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h = handleRef.current;
    if (!h || !rootRef.current) return;
    cleanupRef.current?.();
    h.scrollTop();
    const root = rootRef.current;
    const raf = requestAnimationFrame(() => {
      cleanupRef.current = h.initPage(root);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return <div ref={rootRef}>{children}</div>;
}
