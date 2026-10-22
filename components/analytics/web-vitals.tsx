"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics/track";

/** Field Core Web Vitals (INP can only be measured on real users). Loaded after idle. */
export function WebVitals() {
  useEffect(() => {
    const start = () =>
      import("web-vitals").then(({ onINP, onLCP, onCLS }) => {
        const report = (m: { name: string; value: number; rating: string }) =>
          track("Web Vitals", { metric: m.name, rating: m.rating, value: Math.round(m.name === "CLS" ? m.value * 1000 : m.value) });
        onINP(report);
        onLCP(report);
        onCLS(report);
      });
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 4000 });
    else setTimeout(start, 2500);
  }, []);
  return null;
}
