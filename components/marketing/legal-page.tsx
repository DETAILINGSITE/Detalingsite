import type { ReactNode } from "react";
import { business } from "@/config/business";
import { PageTransition } from "@/components/motion/page-transition";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";

/** Shared shell for legal pages. Template text must be reviewed by a lawyer (launch-check). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <PageTransition>
      <article className="container-site max-w-3xl py-16 md:py-24 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_li]:mb-1.5 [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-fg-muted [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-fg-muted">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-fg-subtle">Last updated {updated}</p>
        {!business.legal.reviewedByCounsel && (
          <PlaceholderBadge className="mt-4" label="Template — have this reviewed by a lawyer before launch" />
        )}
        <div className="mt-8">{children}</div>
      </article>
    </PageTransition>
  );
}
