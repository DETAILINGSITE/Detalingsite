import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ActionForm, AdminInput, AdminTextarea } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { formatMoney } from "@/lib/domain/money";
import { formatAddress } from "@/lib/server/booking/location";
import { signedViewUrl } from "@/lib/server/storage";
import { formatPhoneForDisplay, BUDGET_LABELS } from "@/lib/validation/booking";
import { declineQuoteAction, sendQuoteAction } from "../../actions";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const [q] = await db.select().from(s.quoteRequests).where(eq(s.quoteRequests.id, id));
  if (!q) notFound();
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, q.customerId));
  const photos = await db.select().from(s.quotePhotos).where(and(eq(s.quotePhotos.quoteRequestId, id), eq(s.quotePhotos.status, "attached")));
  const urls = await Promise.all(photos.map((p) => signedViewUrl(p.storageKey).catch(() => null)));
  const services = q.serviceIds.length ? await db.select({ name: s.services.name, id: s.services.id }).from(s.services) : [];
  const serviceNames = services.filter((x) => q.serviceIds.includes(x.id)).map((x) => x.name);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/quotes" className="text-sm text-fg-muted hover:text-fg">← Quotes</Link>
        <h1 className="mt-2 text-3xl font-bold">{q.number} <span className="text-base font-medium capitalize text-fg-muted">{q.status}</span></h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card flex flex-col gap-3 p-5 text-sm" aria-labelledby="req-h">
          <h2 id="req-h" className="font-bold">Request</h2>
          <p className="whitespace-pre-line">{q.description}</p>
          {serviceNames.length > 0 && <p><span className="text-fg-subtle">For:</span> {serviceNames.join(", ")}</p>}
          <p><span className="text-fg-subtle">Vehicle:</span> {[q.vehicleYear, q.vehicleMake, q.vehicleModel, q.vehicleColor].filter(Boolean).join(" ") || "—"} {q.vehicleSizeId ? `(${q.vehicleSizeId})` : ""}</p>
          <p><span className="text-fg-subtle">Location:</span> {q.locationType === "shop" ? "Shop" : formatAddress(q.address)} {q.outOfArea && <strong className="text-warning">· outside regular area</strong>}</p>
          <p><span className="text-fg-subtle">Preferred dates:</span> {q.preferredDates.join(", ") || "—"}</p>
          <p><span className="text-fg-subtle">Budget:</span> {q.budgetRange ? (BUDGET_LABELS[q.budgetRange as keyof typeof BUDGET_LABELS] ?? q.budgetRange) : "—"}</p>
          {c && (
            <p>
              <span className="text-fg-subtle">Customer:</span> {c.name} · {c.email && <a className="text-gold-300 underline" href={`mailto:${c.email}`}>{c.email}</a>}{" "}
              {c.phoneE164 && <>· <a className="text-gold-300 underline" href={`tel:${c.phoneE164}`}>{formatPhoneForDisplay(c.phoneE164)}</a></>}
            </p>
          )}
          {q.bookingId && <Link href={`/admin/bookings/${q.bookingId}`} className="text-gold-300 underline">View booking</Link>}
        </section>
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="price-h">
          <h2 id="price-h" className="font-bold">{q.status === "quoted" ? "Revise quote" : "Send a price"}</h2>
          {q.status === "quoted" && <p className="text-sm text-fg-muted">Current: {formatMoney(q.quotedPriceCents ?? 0)} · sending again replaces the old link.</p>}
          {["new", "quoted"].includes(q.status) ? (
            <>
              <ActionForm action={sendQuoteAction} submitLabel="Send quote to customer">
                <input type="hidden" name="id" value={q.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminInput label="Price ($)" name="price" type="number" step="0.01" required defaultValue={q.quotedPriceCents != null ? (q.quotedPriceCents / 100).toFixed(2) : ""} />
                  <AdminInput label="Hours of work" name="hours" type="number" step="0.25" required defaultValue={q.quotedDurationMin != null ? q.quotedDurationMin / 60 : ""} />
                  <AdminInput label="Deposit ($, optional)" name="deposit" type="number" step="0.01" defaultValue={q.quotedDepositCents != null ? (q.quotedDepositCents / 100).toFixed(2) : ""} />
                </div>
                <AdminInput label="Valid for (days)" name="validDays" type="number" defaultValue={14} />
                <AdminTextarea label="Message to the customer" name="message" defaultValue={q.quoteMessage} rows={4} />
                <p className="text-xs text-fg-muted">Jobs longer than one business day: after the customer books, add time blocks for the extra days in Schedule.</p>
              </ActionForm>
              <ActionForm action={declineQuoteAction} submitLabel="Decline request" variant="danger" confirm="Decline this request?">
                <input type="hidden" name="id" value={q.id} />
                <AdminInput label="Reason (internal)" name="reason" />
              </ActionForm>
            </>
          ) : (
            <p className="text-sm text-fg-muted">This request is {q.status}.</p>
          )}
        </section>
      </div>
      {photos.length > 0 && (
        <section aria-labelledby="ph-h">
          <h2 id="ph-h" className="mb-3 font-bold">Photos</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-white/10">
                {urls[i] ? (
                  <a href={urls[i]!} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls[i]!} alt={`Customer photo ${i + 1}`} className="aspect-square w-full object-cover" />
                  </a>
                ) : (
                  <span className="block p-3 text-xs">{p.contentType} (preview unavailable)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
