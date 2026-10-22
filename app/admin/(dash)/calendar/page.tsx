import Link from "next/link";
import { connection } from "next/server";
import { AdminCalendar, type CalendarColumn, type CalendarItem } from "@/components/admin/calendar";
import { getDb } from "@/db/client";
import { hhmmToMinutes } from "@/lib/domain/settings";
import { Temporal, localMinutesOf, todayIn, wallTimeToEpochLenient } from "@/lib/domain/time";
import { calendarItems } from "@/lib/server/admin/queries";
import { now } from "@/lib/server/clock";
import { loadSchedule, loadSettings } from "@/lib/server/data/settings";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  await connection();
  const sp = await searchParams;
  const db = getDb();
  const [settings, schedule] = await Promise.all([loadSettings(db), loadSchedule(db)]);
  const tz = settings.timezone;
  const view = sp.view === "day" ? "day" : "week";
  const anchor = sp.date ? Temporal.PlainDate.from(sp.date) : todayIn(tz, now());
  const start = view === "week" ? anchor.subtract({ days: anchor.dayOfWeek - 1 }) : anchor;
  const dates = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => start.add({ days: i }));

  // Visible hours: earliest open → latest close (fallback 7–19).
  const opens = schedule.hours.map((h) => hhmmToMinutes(h.opens));
  const closes = schedule.hours.map((h) => hhmmToMinutes(h.closes));
  const dayStart = Math.floor((opens.length ? Math.min(...opens) : 420) / 60) * 60;
  const dayEnd = Math.ceil((closes.length ? Math.max(...closes) : 1140) / 60) * 60;
  const slotMin = 30;
  const slotsPerDay = (dayEnd - dayStart) / slotMin;

  const resources = schedule.resources.filter((r) => r.active);
  const columns: CalendarColumn[] =
    view === "day"
      ? resources.map((r) => ({
          key: r.id,
          label: r.name,
          resourceId: r.id,
          date: start.toString(),
          slots: Array.from({ length: slotsPerDay }, (_, i) => new Date(wallTimeToEpochLenient(start, dayStart + i * slotMin, tz)).toISOString()),
        }))
      : dates.map((d) => ({
          key: d.toString(),
          label: d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          resourceId: null,
          date: d.toString(),
          slots: Array.from({ length: slotsPerDay }, (_, i) => new Date(wallTimeToEpochLenient(d, dayStart + i * slotMin, tz)).toISOString()),
        }));

  const from = new Date(wallTimeToEpochLenient(start, 0, tz));
  const to = new Date(wallTimeToEpochLenient(dates[dates.length - 1]!.add({ days: 1 }), 0, tz));
  const raw = await calendarItems({ from, to }, db);
  const items: CalendarItem[] = raw.map((r) => {
    const startMs = r.startsAt ? r.startsAt.getTime() : r.period.start.getTime();
    const endMs = r.endsAt ? r.endsAt.getTime() : r.period.end.getTime();
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(startMs);
    return {
      id: r.allocationId,
      bookingId: r.bookingId,
      kind: r.kind,
      title: r.kind === "block" ? (r.note || "Blocked") : `${r.number} · ${r.customerName ?? "—"}`,
      status: r.status,
      held: Boolean(r.holdExpiresAt),
      resourceId: r.resourceId,
      date,
      startMin: localMinutesOf(startMs, tz),
      endMin: Math.min(24 * 60, localMinutesOf(startMs, tz) + Math.round((endMs - startMs) / 60_000)),
      startIso: new Date(startMs).toISOString(),
      color: schedule.resources.find((x) => x.id === r.resourceId)?.color ?? "#888",
    };
  });

  const prev = view === "week" ? start.subtract({ days: 7 }) : start.subtract({ days: 1 });
  const next = view === "week" ? start.add({ days: 7 }) : start.add({ days: 1 });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <nav aria-label="Calendar navigation" className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/admin/calendar?view=${view}&date=${prev}`} className="min-h-11 rounded-full px-4 py-2.5 hover:bg-white/10">← Previous</Link>
          <Link href={`/admin/calendar?view=${view}`} className="min-h-11 rounded-full px-4 py-2.5 hover:bg-white/10">Today</Link>
          <Link href={`/admin/calendar?view=${view}&date=${next}`} className="min-h-11 rounded-full px-4 py-2.5 hover:bg-white/10">Next →</Link>
          <Link href={`/admin/calendar?view=day&date=${start}`} aria-current={view === "day" ? "page" : undefined} className="min-h-11 rounded-full px-4 py-2.5 aria-[current=page]:bg-white/10">Day</Link>
          <Link href={`/admin/calendar?view=week&date=${start}`} aria-current={view === "week" ? "page" : undefined} className="min-h-11 rounded-full px-4 py-2.5 aria-[current=page]:bg-white/10">Week</Link>
        </nav>
      </div>
      <AdminCalendar timeZone={tz} view={view} columns={columns} items={items} dayStartMin={dayStart} dayEndMin={dayEnd} slotMin={slotMin} resources={resources.map((r) => ({ id: r.id, name: r.name }))} />
    </div>
  );
}
