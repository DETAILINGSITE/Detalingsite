"use client";
/**
 * Consent banner + gated ad/analytics tags (GA4, Google Ads, Meta Pixel). Rendered only
 * when at least one of those IDs is configured. Default: everything denied.
 */
import Script from "next/script";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Consent = "granted" | "denied" | null;
const KEY = "consent.v1";

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function ConsentTags() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Storage is only readable after mount; reading it during render would mismatch hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readConsent());
    setReady(true);
  }, []);

  const choose = (v: "granted" | "denied") => {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    setConsent(v);
  };

  const ga = process.env.NEXT_PUBLIC_GA4_ID;
  const gads = process.env.NEXT_PUBLIC_GADS_ID;
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const gtagId = ga ?? gads;

  return (
    <>
      {consent === "granted" && gtagId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('consent','default',{ad_storage:'granted',analytics_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});${ga ? `gtag('config','${ga}');` : ""}${gads ? `gtag('config','${gads}');` : ""}`}
          </Script>
        </>
      )}
      {consent === "granted" && pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
      {ready && consent === null && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Cookie preferences"
          className="fixed inset-x-3 bottom-[calc(var(--mobile-bar-h)+0.75rem)] z-[90] mx-auto max-w-xl rounded-2xl border border-white/10 bg-ink-800 p-4 shadow-2xl md:bottom-4"
        >
          <p className="text-sm text-fg-muted">
            We'd like to use advertising cookies to measure our ads. Essential features work without them.{" "}
            <a href="/privacy" className="text-gold-300 underline">Privacy policy</a>
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => choose("denied")}>
              Decline
            </Button>
            <Button size="sm" onClick={() => choose("granted")}>
              Accept
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
