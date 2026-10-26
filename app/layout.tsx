import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { business } from "@/config/business";
import { Analytics } from "@/components/analytics/analytics";
import "./globals.css";

/** One variable family; the wdth axis gives the expanded display cut (≤ 2 families budget). */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
  preload: true,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${business.name} — Premium Mobile Car Detailing`, template: `%s | ${business.name}` },
  description: business.description,
  applicationName: business.name,
  openGraph: { type: "website", siteName: business.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable} style={{ "--brand": business.colors.brand } as CSSProperties}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only fixed top-3 left-3 z-[200] rounded-full bg-gold-400 px-4 py-3 font-semibold text-ink-950 focus:not-sr-only"
        >
          Skip to content
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
