"use client";
/**
 * Boots the motion engine after hydration + idle (so GSAP/Lenis never block first
 * paint) and re-initialises section motion on every client navigation.
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
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(boot, { timeout: 1500 }) : window.setTimeout(boot, 400);
    return () => {
      cancelled = true;
      if (!w.requestIdleCallback) clearTimeout(id);
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
