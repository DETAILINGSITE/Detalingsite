import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { formatDuration, formatMoney } from "@/lib/domain/money";
import { now } from "@/lib/server/clock";
import { loadQuoteByToken } from "@/lib/server/booking/quotes-lookup";
import { declineQuote } from "@/lib/server/quotes";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Your quote", description: "View your quote and book a time.", path: "/quote", noindex: true });

export default async function QuoteTokenPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const q = await loadQuoteByToken(getDb(), token);
  if (!q || q.status === "new") notFound();
  const expired = q.status === "expired" || (q.quoteExpiresAt !== null && q.quoteExpiresAt.getTime() <= now());

  async function decline() {
    "use server";
    await declineQuote({ token }, "Declined by customer", new Date(now()));
    redirect(`/quote/${token}`);
  }

  return (
    <div className="container-site max-w-2xl py-16 md:py-24">
      <div className="card flex flex-col gap-6 p-8">
        <p className="eyebrow">Quote {q.number}</p>
        <h1 className="text-3xl font-bold">
          {q.status === "accepted" ? "This quote has been booked" : q.status === "declined" ? "Quote declined" : expired ? "This quote has expired" : "Your custom quote"}
        </h1>
        {q.quoteMessage && <p className="leading-relaxed text-fg-muted">{q.quoteMessage}</p>}
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-fg-subtle">Price</dt>
            <dd className="tabular text-2xl font-bold">{formatMoney(q.quotedPriceCents ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-sm text-fg-subtle">Estimated time</dt>
            <dd className="text-2xl font-bold">{formatDuration(q.quotedDurationMin ?? 60)}</dd>
          </div>
        </dl>
        {q.status === "quoted" && !expired && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={`/book?quote=${token}`} className={buttonVariants({ size: "lg" })}>
              Accept & choose a time
            </Link>
            <form action={decline}>
              <button type="submit" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                Decline
              </button>
            </form>
          </div>
        )}
        {expired && q.status === "quoted" && (
          <Link href="/contact" className={buttonVariants() + " w-fit"}>Ask for an updated quote</Link>
        )}
      </div>
    </div>
  );
}
