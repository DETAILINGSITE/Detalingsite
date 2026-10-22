/** Client analytics helpers: Plausible custom events + anonymous first-party funnel beacon. */

type Props = Record<string, string | number | boolean>;

export function track(event: string, props?: Props) {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    plausible?: (e: string, o?: { props?: Props }) => void;
    gtag?: (...a: unknown[]) => void;
    fbq?: (...a: unknown[]) => void;
  };
  w.plausible?.(event, props ? { props } : undefined);
  w.gtag?.("event", event.toLowerCase().replace(/\s+/g, "_"), props);
}

const SID_KEY = "funnel.sid";
export function funnelSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

export function funnel(event: "step_view" | "step_complete", step: string, utm?: string) {
  track(event === "step_view" ? "Booking Step View" : "Booking Step Complete", { step });
  try {
    const body = JSON.stringify({ sid: funnelSessionId(), event, step, utm });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", body, keepalive: true });
  } catch {
    // analytics must never break the flow
  }
}

// ── UTM / referrer attribution (first touch, this browser session) ───────────
const ATTR_KEY = "attribution.v1";
export interface ClientAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPath?: string;
  firstSeenAt?: string;
}

export function captureAttribution() {
  try {
    if (sessionStorage.getItem(ATTR_KEY)) return;
    const u = new URL(window.location.href);
    const p = u.searchParams;
    const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : undefined;
    const attr: ClientAttribution = {
      utmSource: p.get("utm_source") ?? undefined,
      utmMedium: p.get("utm_medium") ?? undefined,
      utmCampaign: p.get("utm_campaign") ?? undefined,
      utmTerm: p.get("utm_term") ?? undefined,
      utmContent: p.get("utm_content") ?? undefined,
      referrer: ref?.slice(0, 500),
      landingPath: (u.pathname + u.search).slice(0, 500),
      firstSeenAt: new Date().toISOString(),
    };
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr));
  } catch {}
}

export function getAttribution(): ClientAttribution {
  try {
    const raw = sessionStorage.getItem(ATTR_KEY);
    if (raw) return JSON.parse(raw) as ClientAttribution;
  } catch {}
  return {};
}
