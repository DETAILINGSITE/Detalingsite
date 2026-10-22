import { Suspense, type ReactNode } from "react";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";

/**
 * Booking, manage and quote-link pages: rendered per request (strict nonce CSP),
 * native scrolling (no Lenis), no decorative motion.
 */
export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header minimal />
      <main id="main" tabIndex={-1} className="min-h-[70dvh] outline-none">
        <Suspense fallback={<FlowSkeleton />}>{children}</Suspense>
      </main>
      <Footer />
    </>
  );
}

function FlowSkeleton() {
  return (
    <div className="container-site py-16" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
