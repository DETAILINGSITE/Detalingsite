import type { ReactNode } from "react";
import { MotionRoot } from "@/components/motion/motion-root";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { MobileBar } from "@/components/site/mobile-bar";
import { ExitIntentOfferLazy } from "@/components/marketing/exit-intent-lazy";
import { business } from "@/config/business";

/** Marketing pages are fully static — the build fails if anything dynamic sneaks in. */
export const ensureStatic = "navigation";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <MotionRoot>
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
      </MotionRoot>
      <MobileBar />
      {business.flags.exitIntentOffer && <ExitIntentOfferLazy />}
    </>
  );
}
