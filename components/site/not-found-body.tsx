import { CtaLink } from "@/components/ui/cta-link";

/** 404 content, shared by the root not-found (own header) and the marketing one (layout's header). */
export function NotFoundBody() {
  return (
    <div className="container-site flex min-h-[70dvh] flex-col items-start justify-center gap-6 py-24">
      <svg viewBox="0 0 120 40" className="w-28 animate-rise text-gold-300" aria-hidden="true">
        <path d="M6 30c3-9 10-14 20-15l12-2c6-6 14-10 24-10s20 4 26 10l14 2c6 1 10 5 10 15z" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="32" cy="31" r="6" fill="currentColor" />
        <circle cx="92" cy="31" r="6" fill="currentColor" />
      </svg>
      <p className="eyebrow">404</p>
      <h1 className="text-[clamp(2.6rem,7vw,5.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
        Wrong <span className="serif electric font-normal">turn.</span>
      </h1>
      <p className="max-w-md text-lg text-fg-muted">That page doesn&apos;t exist — but your car can still look brand new.</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <CtaLink href="/" size="md">
          Back to home
        </CtaLink>
        <CtaLink href="/book" variant="glass" size="md">
          Book a detail
        </CtaLink>
      </div>
    </div>
  );
}
