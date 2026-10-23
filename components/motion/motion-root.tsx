"use client";
/**
 * Boots the motion engine on the first scroll/touch/key/pointer, or after a few idle seconds,
 * so GSAP/Lenis (~50 KB gz) never compete with first paint or LCP. Content is fully visible
 * without it; it only adds reveals for what's still below the fold. Re-inits per navigation.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { captureAttribution } from "@/lib/analytics/track";
import type { MotionHandle } from "@/lib/motion/engine";

export function MotionRoot({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MotionHandle | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
    let cancelled = false;
    const boot = () =>
      import("@/lib/motion/engine")
        .then(({ startMotion }) => {
          if (cancelled || !rootRef.current) return;
          handleRef.current = startMotion();
          cleanupRef.current = handleRef.current.initPage(rootRef.current);
        })
        .catch((err) => console.warn("[motion] disabled:", err));
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
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const timer = window.setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2000 }) : start()), 3500);
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
