import { and, eq, gte, sql } from "drizzle-orm";
import { connection } from "next/server";
import { ActionForm, AdminCheck, AdminInput, AdminSelect } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { formatDateTimeLong } from "@/lib/domain/time";
import { now } from "@/lib/server/clock";
import { loadSchedule, loadSettings } from "@/lib/server/data/settings";
import { WEEKDAYS } from "@/lib/site/nav";
import { blackoutAction, hoursSaveAction, resourceSaveAction, timeBlockAction } from "../actions";

export default async function SchedulePage() {
  await connection();
  const db = getDb();
  const [schedule, settings] = await Promise.all([loadSchedule(db), loadSettings(db)]);
  const blocks = await db
    .select({ a: s.resourceAllocations, r: s.resources })
    .from(s.resourceAllocations)
    .innerJoin(s.resources, eq(s.resources.id, s.resourceAllocations.resourceId))
    .where(and(eq(s.resourceAllocations.kind, "block"), eq(s.resourceAllocations.active, true), gte(sql`upper(${s.resourceAllocations.period})`, new Date(now()).toISOString())));
  const tz = settings.timezone;

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-bold">Schedule</h1>
      <p className="-mt-6 text-sm text-fg-muted">All times are in {tz}.</p>

      <section aria-labelledby="hours-h" className="card p-5">
        <h2 id="hours-h" className="mb-4 text-xl font-bold">Opening hours</h2>
        <ActionForm action={hoursSaveAction} submitLabel="Save hours">
          <div className="flex flex-col gap-2">
            {WEEKDAYS.map((day, i) => {
              const h = schedule.hours.find((x) => x.weekday === i + 1);
              return (
                <div key={day} className="grid grid-cols-[120px_auto_1fr_1fr] items-center gap-3">
                  <span className="text-sm font-semibold">{day}</span>
                  <AdminCheck label="Open" name={`open_${i + 1}`} defaultChecked={!!h} />
                  <AdminInput label="Opens" name={`opens_${i + 1}`} type="time" defaultValue={h?.opens ?? "08:00"} />
                  <AdminInput label="Closes" name={`closes_${i + 1}`} type="time" defaultValue={h?.closes ?? "17:00"} />
                </div>
              );
            })}
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby="bo-h" className="card p-5">
        <h2 id="bo-h" className="mb-4 text-xl font-bold">Closed dates (holidays)</h2>
        <ul className="mb-4 flex flex-wrap gap-2">
          {schedule.blackoutDates.map((b) => (
            <li key={b.date} className="flex items-center gap-2 rounded-full border border-white/10 py-1 pr-1 pl-3 text-sm">
              {b.date} {b.reason && `· ${b.reason}`}
              <ActionForm action={blackoutAction} submitLabel="Remove" variant="ghost">
                <input type="hidden" name="op" value="remove" />
                <input type="hidden" name="date" value={b.date} />
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={blackoutAction} submitLabel="Add closed date">
          <input type="hidden" name="op" value="add" />
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput label="Date" name="date" type="date" required />
            <AdminInput label="Reason" name="reason" />
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby="res-h" className="flex flex-col gap-4">
        <h2 id="res-h" className="text-xl font-bold">Crews & bays (how many jobs can run at once)</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {[...schedule.resources, undefined].map((r) => (
            <div key={r?.id ?? "new"} className="card p-4">
              <ActionForm action={resourceSaveAction} submitLabel={r ? "Save" : "Add"}>
                <input type="hidden" name="id" value={r?.id ?? ""} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminInput label="Name" name="name" defaultValue={r?.name ?? ""} required />
                  <AdminSelect label="Type" name="type" defaultValue={r?.type ?? "mobile_crew"} options={[{ value: "mobile_crew", label: "Mobile crew" }, { value: "shop_bay", label: "Shop bay" }]} />
                  <AdminInput label="Colour" name="color" type="color" defaultValue={r?.color ?? "#c8a24a"} />
                </div>
                <AdminCheck label="Active" name="active" defaultChecked={r?.active ?? true} />
              </ActionForm>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="blk-h" className="card p-5">
        <h2 id="blk-h" className="mb-2 text-xl font-bold">Time blocks</h2>
        <p className="mb-4 text-sm text-fg-muted">Block a crew or bay (time off, equipment down, or extra days of a multi-day job). Blocks can't overlap bookings.</p>
        <ul className="mb-4 flex flex-col gap-2 text-sm">
          {blocks.map(({ a, r }) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-800 p-3">
              <span>
                {r.name}: {formatDateTimeLong(a.period.start.getTime(), tz)} → {formatDateTimeLong(a.period.end.getTime(), tz)} {a.note && `· ${a.note}`}
              </span>
              <ActionForm action={timeBlockAction} submitLabel="Remove" variant="ghost">
                <input type="hidden" name="op" value="remove" />
                <input type="hidden" name="id" value={a.id} />
              </ActionForm>
            </li>
          ))}
          {blocks.length === 0 && <li className="text-fg-muted">No upcoming blocks.</li>}
        </ul>
        <TimeBlockForm resources={schedule.resources.map((r) => ({ value: r.id, label: r.name }))} tz={tz} />
      </section>
    </div>
  );
}

function TimeBlockForm({ resources, tz }: { resources: { value: string; label: string }[]; tz: string }) {
  return (
    <ActionForm action={timeBlockAction} submitLabel="Add block">
      <input type="hidden" name="op" value="add" />
      <input type="hidden" name="tz" value={tz} />
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminSelect label="Crew / bay" name="resourceId" options={resources} />
        <AdminInput label={`Start (ISO, e.g. 2026-11-03T09:00:00-06:00)`} name="start" required placeholder="2026-11-03T09:00:00-06:00" />
        <AdminInput label="End (ISO)" name="end" required placeholder="2026-11-03T17:00:00-06:00" />
      </div>
      <AdminInput label="Note" name="note" />
    </ActionForm>
  );
}
