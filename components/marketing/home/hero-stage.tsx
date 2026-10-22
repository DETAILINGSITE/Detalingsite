"use client";
/**
 * Decides whether this device gets the 3D hero, then lazy-loads it (ssr: false) only
 * after first interaction or idle. Fallback for everything else = the static poster.
 * Never throws: WebGL failures are caught by the boundary inside HeroCanvas.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroCanvas = dynamic(() => import("@/components/three/hero-canvas"), { ssr: false, loading: () => null });

export function canRun3D(): { ok: boolean; reason?: string } {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return { ok: false, reason: "reduced-motion" };
  if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return { ok: false, reason: "reduced-data" };
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.connection?.saveData) return { ok: false, reason: "save-data" };
  if (nav.connection?.effectiveType && /(^|-)2g|3g/.test(nav.connection.effectiveType)) return { ok: false, reason: "slow-network" };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  if (cores <= 4 && memory <= 4) return { ok: false, reason: "low-power" };
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return { ok: false, reason: "no-webgl2" };
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    return { ok: false, reason: "no-webgl2" };
  }
  return { ok: true };
}

export function HeroStage() {
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const check = canRun3D();
    document.documentElement.dataset.hero3d = check.ok ? "pending" : `off:${check.reason}`;
    if (!check.ok) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      cleanup();
      // Don't download Three.js until we know a licensed model has been added.
      fetch("/models/car.glb", { method: "HEAD" })
        .then((r) => {
          if (r.ok) setLoad(true);
          else document.documentElement.dataset.hero3d = "off:no-model";
        })
        .catch(() => (document.documentElement.dataset.hero3d = "off:no-model"));
    };
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    // Desktop also loads on idle; mobile waits for interaction to protect data and battery.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const idle = !mobile
      ? window.setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 2000 }) : go()), 3500)
      : undefined;
    function cleanup() {
      events.forEach((e) => window.removeEventListener(e, go));
      if (idle) clearTimeout(idle);
    }
    return cleanup;
  }, []);

  if (!load) return null;
  return <HeroCanvas />;
}
