import { desc, ilike, isNull, or, sql, and } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { formatMoney } from "@/lib/domain/money";
import { formatPhoneForDisplay } from "@/lib/validation/booking";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();
  const { q } = await searchParams;
  const term = q?.trim() ? `%${q.trim()}%` : null;
  const rows = await getDb()
    .select({
      c: s.customers,
      bookings: sql<number>`(select count(*)::int from bookings b where b.customer_id = ${s.customers.id} and b.status in ('confirmed','in_progress','completed','no_show'))`,
      spend: sql<number>`(select coalesce(sum(b.total_cents),0)::int from bookings b where b.customer_id = ${s.customers.id} and b.status = 'completed')`,
    })
    .from(s.customers)
    .where(and(isNull(s.customers.anonymizedAt), term ? or(ilike(s.customers.name, term), ilike(s.customers.email, term), ilike(s.customers.phoneE164, term)) : undefined))
    .orderBy(desc(s.customers.createdAt))
    .limit(100);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Link href="/admin/export?type=customers" className="text-sm text-gold-300 underline">Export CSV</Link>
      </div>
      <form role="search" className="flex gap-2">
        <label htmlFor="cq" className="sr-only">Search customers</label>
        <input id="cq" name="q" defaultValue={q} placeholder="Name, email or phone" className="min-h-11 w-72 rounded-xl border border-white/12 bg-ink-850 px-3" />
        <button className="min-h-11 rounded-full bg-white/10 px-5 text-sm font-semibold">Search</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-white/10" role="region" aria-label="Customers" tabIndex={0}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-ink-800 text-fg-subtle"><tr>{["Name", "Email", "Phone", "Bookings", "Lifetime value"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map(({ c, bookings, spend }) => (
              <tr key={c.id}>
                <td className="px-4 py-3"><Link href={`/admin/customers/${c.id}`} className="font-semibold text-gold-300 hover:underline">{c.name}</Link></td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3">{c.phoneE164 ? formatPhoneForDisplay(c.phoneE164) : "—"}</td>
                <td className="tabular px-4 py-3">{bookings}</td>
                <td className="tabular px-4 py-3">{formatMoney(spend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
