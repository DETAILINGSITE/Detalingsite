/**
 * Proxy (Next 16's renamed middleware): sets the CSP for every page and gives /admin
 * a fast redirect when no session cookie exists. The real admin guard is server-side
 * (lib/server/admin-guard.ts) — this is only a convenience.
 */
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, isDynamicRoute } from "@/lib/security/csp";

const ADMIN_COOKIES = ["admin.session_token", "__Secure-admin.session_token"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const hasSession = ADMIN_COOKIES.some((c) => request.cookies.has(c));
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const dev = process.env.NODE_ENV !== "production";
  const secure = (process.env.NEXT_PUBLIC_SITE_URL ?? "https:").startsWith("https:");
  const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? null;
  const adsEnabled = Boolean(
    process.env.NEXT_PUBLIC_GA4_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.NEXT_PUBLIC_GADS_ID,
  );

  if (isDynamicRoute(pathname)) {
    const nonce = btoa(crypto.randomUUID());
    const csp = buildCsp({ mode: "strict", nonce, dev, secure, plausibleSrc, adsEnabled });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    if (pathname.startsWith("/booking/") || pathname.startsWith("/quote/")) {
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    if (pathname.startsWith("/admin") || pathname.startsWith("/book")) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", buildCsp({ mode: "static", dev, secure, plausibleSrc, adsEnabled }));
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|images|models|brand|fonts|robots.txt|sitemap.xml|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
