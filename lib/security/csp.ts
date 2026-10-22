/**
 * Content-Security-Policy builder (docs/PLAN.md §9).
 *
 * Next.js can only nonce dynamically rendered pages. So:
 * - "strict" (nonce + strict-dynamic) for /book, /booking/*, /quote/<token>, /admin/*
 * - "static" (host allowlist; inline scripts allowed because prerendered HTML contains
 *   Next's inline RSC payload) for the prerendered marketing pages.
 * Neither ever allows 'unsafe-eval' in production.
 */
export interface CspOptions {
  mode: "strict" | "static";
  nonce?: string;
  dev: boolean;
  plausibleSrc?: string | null;
  extraImgHosts?: string[];
  adsEnabled?: boolean;
}

const STRIPE = ["https://js.stripe.com", "https://*.js.stripe.com"];
const TURNSTILE = "https://challenges.cloudflare.com";

export function buildCsp(o: CspOptions): string {
  const plausibleHost = o.plausibleSrc ? new URL(o.plausibleSrc).origin : "https://plausible.io";
  const ads = o.adsEnabled
    ? ["https://www.googletagmanager.com", "https://www.google-analytics.com", "https://connect.facebook.net"]
    : [];
  const script =
    o.mode === "strict"
      ? [`'nonce-${o.nonce}'`, "'strict-dynamic'", "'self'", ...STRIPE, TURNSTILE, plausibleHost, ...ads]
      : ["'self'", "'unsafe-inline'", ...STRIPE, TURNSTILE, plausibleHost, ...ads];
  if (o.dev) script.push("'unsafe-eval'");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": script,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://*.stripe.com", ...(o.extraImgHosts ?? []), ...(o.adsEnabled ? ["https://www.facebook.com", "https://www.google-analytics.com"] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "https://api.stripe.com", "https://*.stripe.com", TURNSTILE, plausibleHost, ...(o.extraImgHosts ?? []), ...(o.adsEnabled ? ["https://www.google-analytics.com", "https://*.google-analytics.com"] : [])],
    "frame-src": [...STRIPE, "https://hooks.stripe.com", TURNSTILE, "https://www.google.com"],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${[...new Set(v)].join(" ")}`);
  if (!o.dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Routes rendered per request — these get the strict nonce policy. */
export function isDynamicRoute(pathname: string): boolean {
  return (
    pathname === "/book" ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/booking/") ||
    pathname.startsWith("/admin") ||
    /^\/quote\/[A-Za-z0-9_-]{43}$/.test(pathname)
  );
}
