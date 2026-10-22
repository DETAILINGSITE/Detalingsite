import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { ActionForm, AdminSelect, AdminTextarea } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { formatPhoneForDisplay } from "@/lib/validation/booking";
import { leadUpdateAction } from "../actions";

const STATUSES = ["new", "contacted", "won", "lost", "spam"] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await connection();
  const { status } = await searchParams;
  const filter = STATUSES.includes(status as (typeof STATUSES)[number]) ? (status as (typeof STATUSES)[number]) : null;
  const leads = await getDb()
    .select()
    .from(s.leads)
    .where(filter ? eq(s.leads.status, filter) : undefined)
    .orderBy(desc(s.leads.createdAt))
    .limit(100);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Leads</h1>
        <nav aria-label="Filter" className="flex flex-wrap gap-1 text-sm">
          <Link href="/admin/leads" className="min-h-11 rounded-full px-4 py-2.5 hover:bg-white/10" aria-current={!filter ? "page" : undefined}>All</Link>
          {STATUSES.map((st) => (
            <Link key={st} href={`/admin/leads?status=${st}`} aria-current={filter === st ? "page" : undefined} className="min-h-11 rounded-full px-4 py-2.5 capitalize hover:bg-white/10 aria-[current=page]:bg-white/10">{st}</Link>
          ))}
        </nav>
      </div>
      <ul className="flex flex-col gap-4">
        {leads.map((l) => (
          <li key={l.id} className="card grid gap-4 p-5 md:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-1.5 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{l.source.replace("_", " ")}</span>
                <span className="text-fg-subtle">{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
              </p>
              <p className="text-base font-semibold">{l.name ?? "—"}</p>
              <p>
                {l.email && <a href={`mailto:${l.email}`} className="text-gold-300 hover:underline">{l.email}</a>}
                {l.phoneE164 && <> · <a href={`tel:${l.phoneE164}`} className="text-gold-300 hover:underline">{formatPhoneForDisplay(l.phoneE164)}</a></>}
              </p>
              {l.message && <p className="whitespace-pre-line text-fg-muted">{l.message}</p>}
              <p className="text-xs text-fg-subtle">
                Source: {l.attribution.utmSource ?? (l.attribution.referrer ? `referral (${l.attribution.referrer})` : "direct")}
                {l.bookingId && <> · <Link href={`/admin/bookings/${l.bookingId}`} className="underline">booking</Link></>}
                {l.quoteRequestId && <> · <Link href={`/admin/quotes/${l.quoteRequestId}`} className="underline">quote</Link></>}
              </p>
            </div>
            <ActionForm action={leadUpdateAction}>
              <input type="hidden" name="id" value={l.id} />
              <AdminSelect label="Status" name="status" defaultValue={l.status} options={STATUSES.map((x) => ({ value: x, label: x }))} />
              <AdminTextarea label="Notes" name="notes" defaultValue={l.notes} rows={2} />
            </ActionForm>
          </li>
        ))}
        {leads.length === 0 && <li className="text-fg-muted">No leads yet.</li>}
      </ul>
    </div>
  );
}
