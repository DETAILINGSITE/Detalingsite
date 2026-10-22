import Script from "next/script";
import { ConsentTags } from "./consent";
import { WebVitals } from "./web-vitals";

/**
 * Plausible is cookieless, so it needs no consent banner. GA4 / Meta / Google Ads are
 * optional and only load after explicit opt-in (ConsentTags).
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.tagged-events.js";
  const adsConfigured = Boolean(
    process.env.NEXT_PUBLIC_GA4_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_GADS_ID,
  );
  return (
    <>
      {domain && <Script src={src} data-domain={domain} strategy="afterInteractive" />}
      <WebVitals />
      {adsConfigured && <ConsentTags />}
    </>
  );
}
