"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="container-site flex min-h-[70dvh] flex-col items-start justify-center gap-6 py-24">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="text-[clamp(2rem,5vw,3.6rem)] leading-[1] font-extrabold">We hit a bump.</h1>
      <p className="max-w-md text-lg text-fg-muted">
        Please try again. If it keeps happening, <Link href="/contact" className="text-gold-300 underline">contact us</Link> and we'll book you in directly.
      </p>
      {error.digest && <p className="text-xs text-fg-subtle">Reference: {error.digest}</p>}
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Home
        </Link>
      </div>
    </main>
  );
}
