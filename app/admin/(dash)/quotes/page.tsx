import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { formatMoney } from "@/lib/domain/money";

export default async function QuotesPage() {
  await connection();
  const rows = await getDb()
    .select({ q: s.quoteRequests, name: s.customers.name })
    .from(s.quoteRequests)
    .leftJoin(s.customers, eq(s.customers.id, s.quoteRequests.customerId))
    .orderBy(desc(s.quoteRequests.createdAt))
    .limit(100);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Quote requests</h1>
      <div className="overflow-x-auto rounded-2xl border border-white/10" role="region" aria-label="Quote requests" tabIndex={0}>
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-ink-800 text-fg-subtle">
            <tr>{["Reference", "Received", "Customer", "Status", "Price", "Notes"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map(({ q, name }) => (
              <tr key={q.id}>
                <td className="px-4 py-3"><Link href={`/admin/quotes/${q.id}`} className="font-semibold text-gold-300 hover:underline">{q.number}</Link></td>
                <td className="px-4 py-3">{q.createdAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3">{name ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{q.status}</td>
                <td className="tabular px-4 py-3">{q.quotedPriceCents != null ? formatMoney(q.quotedPriceCents) : "—"}</td>
                <td className="px-4 py-3 text-fg-muted">{q.outOfArea ? "Outside area" : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-fg-muted">No quote requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
