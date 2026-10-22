import Link from "next/link";
import { connection } from "next/server";
import { STATUS_LABELS } from "@/lib/domain/booking-state";
import { formatMoney } from "@/lib/domain/money";
import { health, metrics } from "@/lib/server/admin/queries";
import { now } from "@/lib/server/clock";
import { STEP_LABELS } from "@/lib/booking/wizard-state";

const RANGES = { "7": 7, "30": 30, "90": 90 } as const;

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ days?: string; denied?: string }> }) {
  await connection();
  const sp = await searchParams;
  const days = RANGES[(sp.days ?? "30") as keyof typeof RANGES] ?? 30;
  const to = new Date(now() + 86_400_000);
  const from = new Date(now() - days * 86_400_000);
  const [m, h] = await Promise.all([metrics({ from, to }), health()]);
  const maxFunnel = Math.max(1, ...m.funnel.map((f) => f.sessions));
  const cronStale = !h.lastCron || now() - h.lastCron.startedAt.getTime() > 30 * 60_000;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Overview</h1>
        <nav aria-label="Date range" className="flex gap-1">
          {Object.keys(RANGES).map((d) => (
            <Link key={d} href={`/admin?days=${d}`} aria-current={String(days) === d ? "page" : undefined} className="min-h-11 rounded-full px-4 py-2.5 text-sm aria-[current=page]:bg-white/10">
              {d} days
            </Link>
          ))}
        </nav>
      </div>
      {sp.denied && <p role="alert" className="rounded-xl bg-warning/10 p-3 text-sm text-warning">That page is for the owner account only.</p>}

      {(cronStale || h.failedOutbox > 0 || h.webhookErrors > 0) && (
        <section aria-label="Health" className="rounded-2xl border border-warning/40 bg-warning/10 p-5 text-sm">
          <h2 className="font-bold text-warning">Needs attention</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {cronStale && <li>Scheduled jobs haven't run in the last 30 minutes (reminders may be delayed). Check the cron setup.</li>}
            {h.failedOutbox > 0 && <li>{h.failedOutbox} message(s) or refund(s) failed after retries.</li>}
            {h.webhookErrors > 0 && <li>{h.webhookErrors} payment webhook(s) failed to process — check Stripe.</li>}
          </ul>
          {h.recentFailures.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-fg-muted">
              {h.recentFailures.map((f) => (
                <li key={f.id}>
                  {f.type} · {f.dedupeKey} · {f.lastError}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Appointments", String(m.bookings)],
          ["Booked value", formatMoney(m.bookedCents)],
          ["Collected (net)", formatMoney(m.collectedCents)],
          ["New bookings", String(m.newBookings)],
        ].map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-sm text-fg-muted">{label}</p>
            <p className="tabular mt-1 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="funnel-h" className="card p-6">
          <h2 id="funnel-h" className="mb-4 text-lg font-bold">Booking funnel (sessions reaching each step)</h2>
          <ol className="flex flex-col gap-3">
            {m.funnel.map((f, i) => {
              const prev = i > 0 ? (m.funnel[i - 1]?.sessions ?? 0) : 0;
              const conv = i > 0 && prev > 0 ? Math.round((f.sessions / prev) * 100) : null;
              return (
                <li key={f.step} className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span>{STEP_LABELS[f.step as keyof typeof STEP_LABELS] ?? "Confirmed"}</span>
                    <span className="tabular text-fg-muted">
                      {f.sessions}
                      {conv !== null && ` · ${conv}%`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                    <div className="h-full origin-left rounded-full bg-gold-400" style={{ transform: `scaleX(${f.sessions / maxFunnel})` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <section aria-labelledby="src-h" className="card p-6">
          <h2 id="src-h" className="mb-4 text-lg font-bold">Lead & booking sources</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-fg-subtle">
              <tr>
                <th scope="col" className="py-2 font-medium">Source</th>
                <th scope="col" className="py-2 font-medium">Leads</th>
                <th scope="col" className="py-2 font-medium">Bookings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {m.sources.map((r) => (
                <tr key={r.source}>
                  <td className="py-2">{r.source}</td>
                  <td className="tabular py-2">{r.leads}</td>
                  <td className="tabular py-2">{r.bookings}</td>
                </tr>
              ))}
              {m.sources.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-fg-muted">No data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          <h3 className="mt-6 mb-2 font-semibold">Appointments by status</h3>
          <ul className="flex flex-wrap gap-2 text-sm">
            {m.byStatus.map((b) => (
              <li key={b.status} className="rounded-full border border-white/10 px-3 py-1">
                {STATUS_LABELS[b.status]}: {b.n}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
