import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ActionForm } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { STATUS_LABELS } from "@/lib/domain/booking-state";
import { formatMoney } from "@/lib/domain/money";
import { formatDateTimeLong } from "@/lib/domain/time";
import { requireAdminPage } from "@/lib/server/admin-guard";
import { formatPhoneForDisplay } from "@/lib/validation/booking";
import { anonymizeCustomerAction } from "../../actions";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const session = await requireAdminPage();
  const { id } = await params;
  const db = getDb();
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, id));
  if (!c) notFound();
  const [bookings, quotes, leads] = await Promise.all([
    db.select().from(s.bookings).where(eq(s.bookings.customerId, id)).orderBy(desc(s.bookings.startsAt)),
    db.select().from(s.quoteRequests).where(eq(s.quoteRequests.customerId, id)).orderBy(desc(s.quoteRequests.createdAt)),
    db.select().from(s.leads).where(eq(s.leads.customerId, id)).orderBy(desc(s.leads.createdAt)),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/customers" className="text-sm text-fg-muted hover:text-fg">← Customers</Link>
        <h1 className="mt-2 text-3xl font-bold">{c.name}</h1>
        <p className="text-fg-muted">
          {c.email} {c.phoneE164 && `· ${formatPhoneForDisplay(c.phoneE164)}`} · prefers {c.preferredContact} · SMS {c.smsOptOutAt ? "opted out" : c.smsConsentAt ? `consented ${c.smsConsentAt.toISOString().slice(0, 10)} (v${c.smsConsentTextVersion})` : "no consent"}
        </p>
      </div>
      <section aria-labelledby="hist" className="card p-5">
        <h2 id="hist" className="mb-3 font-bold">Bookings</h2>
        <ul className="flex flex-col divide-y divide-white/[0.06] text-sm">
          {bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap justify-between gap-3 py-2.5">
              <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-gold-300 hover:underline">{b.number}</Link>
              <span>{formatDateTimeLong(b.startsAt.getTime(), b.timezone)}</span>
              <span>{STATUS_LABELS[b.status]}</span>
              <span className="tabular">{formatMoney(b.totalCents)}</span>
            </li>
          ))}
          {bookings.length === 0 && <li className="py-2 text-fg-muted">No bookings.</li>}
        </ul>
      </section>
      {(quotes.length > 0 || leads.length > 0) && (
        <section aria-labelledby="other" className="card p-5 text-sm">
          <h2 id="other" className="mb-3 font-bold">Quotes & enquiries</h2>
          <ul className="flex flex-col gap-2">
            {quotes.map((q) => <li key={q.id}><Link href={`/admin/quotes/${q.id}`} className="text-gold-300 underline">{q.number}</Link> · {q.status}</li>)}
            {leads.map((l) => <li key={l.id}>{l.source.replace("_", " ")} · {l.status} · {l.createdAt.toISOString().slice(0, 10)}</li>)}
          </ul>
        </section>
      )}
      {session.role === "owner" && !c.anonymizedAt && (
        <section aria-labelledby="priv" className="card p-5">
          <h2 id="priv" className="mb-2 font-bold">Privacy request</h2>
          <p className="mb-3 text-sm text-fg-muted">Removes name, email and phone from this customer and their leads. Booking and payment records are kept for accounting.</p>
          <ActionForm action={anonymizeCustomerAction} submitLabel="Anonymize customer" variant="danger" confirm="This cannot be undone. Continue?">
            <input type="hidden" name="id" value={c.id} />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
