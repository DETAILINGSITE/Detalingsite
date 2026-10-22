import Link from "next/link";
import { connection } from "next/server";
import { BOOKING_STATUSES, STATUS_LABELS } from "@/lib/domain/booking-state";
import { formatMoney } from "@/lib/domain/money";
import { formatDateTimeLong } from "@/lib/domain/time";
import { listBookings } from "@/lib/server/admin/queries";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const rows = await listBookings({ q: sp.q, status: sp.status, from: sp.from, to: sp.to, page: Number(sp.page ?? 1) });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Bookings</h1>
        <Link href={`/admin/export?type=bookings`} className="text-sm text-gold-300 underline">Export CSV</Link>
      </div>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-sm">
          <span>Search</span>
          <input name="q" defaultValue={sp.q} placeholder="Name, email, phone, number" className="min-h-11 rounded-xl border border-white/12 bg-ink-850 px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Status</span>
          <select name="status" defaultValue={sp.status ?? "all"} className="min-h-11 rounded-xl border border-white/12 bg-ink-850 px-3">
            <option value="all">All active & past</option>
            {BOOKING_STATUSES.map((s0) => (
              <option key={s0} value={s0}>{STATUS_LABELS[s0]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>From</span>
          <input type="date" name="from" defaultValue={sp.from} className="min-h-11 rounded-xl border border-white/12 bg-ink-850 px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>To</span>
          <input type="date" name="to" defaultValue={sp.to} className="min-h-11 rounded-xl border border-white/12 bg-ink-850 px-3" />
        </label>
        <button className="min-h-11 rounded-full bg-white/10 px-5 text-sm font-semibold">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-white/10" role="region" aria-label="Bookings" tabIndex={0}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-ink-800 text-fg-subtle">
            <tr>
              {["Number", "When", "Customer", "Where", "Status", "Total"].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map(({ b, c }) => (
              <tr key={b.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-gold-300 hover:underline">{b.number}</Link>
                </td>
                <td className="px-4 py-3">{formatDateTimeLong(b.startsAt.getTime(), b.timezone)}</td>
                <td className="px-4 py-3">{c?.name ?? "—"}</td>
                <td className="px-4 py-3">{b.locationType === "shop" ? "Shop" : (b.address?.city ?? "Mobile")}</td>
                <td className="px-4 py-3">{STATUS_LABELS[b.status]}</td>
                <td className="tabular px-4 py-3">{formatMoney(b.totalCents)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-fg-muted">No bookings match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
