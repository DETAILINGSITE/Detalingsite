"use client";
/**
 * Cloudflare Turnstile (~40 lines instead of a dependency). Loads the script only when
 * a form that needs it is on screen. Without a site key (dev/test) it yields the
 * deterministic test token accepted by CAPTCHA_DRIVER=test.
 */
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
  return new Promise((resolve, reject) => {
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile failed to load")));
    if (!existing) {
      s.src = SRC;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export function Turnstile({ action, onToken, resetKey }: { action: string; onToken: (t: string | null) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      onToken("test-pass");
      return;
    }
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          size: "flexible",
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, action, resetKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}
