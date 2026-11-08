import { existsSync } from "node:fs";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\"), usb=(), interest-cohort=()",
  },
];

const r2Host = process.env.NEXT_PUBLIC_MEDIA_HOST;

const nextConfig: NextConfig = {
  // Lets a second build live beside a running server (e.g. verifying a change while a shared preview stays up).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The hero uses a licensed car model when one is in public/models; checked once at build so the
  // browser doesn't have to probe for it (a missing file logged a 404 on every home page visit).
  env: { NEXT_PUBLIC_HERO_MODEL: existsSync("public/models/car.glb") ? "1" : "" },
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: r2Host ? [{ protocol: "https", hostname: r2Host }] : [],
  },
  serverExternalPackages: ["embedded-postgres", "twilio"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
