import Link from "next/link";
import { Header } from "@/components/site/header";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <Header minimal />
      <main id="main" className="container-site flex min-h-[70dvh] flex-col items-start justify-center gap-6 py-24">
        <svg viewBox="0 0 120 40" className="w-28 animate-rise text-gold-300" aria-hidden="true">
          <path d="M6 30c3-9 10-14 20-15l12-2c6-6 14-10 24-10s20 4 26 10l14 2c6 1 10 5 10 15z" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="32" cy="31" r="6" fill="currentColor" />
          <circle cx="92" cy="31" r="6" fill="currentColor" />
        </svg>
        <p className="eyebrow">404</p>
        <h1 className="text-[clamp(2.2rem,5vw,4rem)] leading-[1] font-extrabold">Wrong turn.</h1>
        <p className="max-w-md text-lg text-fg-muted">That page doesn't exist — but your car can still look brand new.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className={buttonVariants()}>
            Back to home
          </Link>
          <Link href="/book" className={buttonVariants({ variant: "secondary" })}>
            Book a detail
          </Link>
        </div>
      </main>
    </>
  );
}
