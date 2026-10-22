import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { ActionForm, AdminCheck, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { loadSettings } from "@/lib/server/data/settings";
import { cityPageSaveAction, zoneSaveAction } from "../actions";

export default async function AreaPage() {
  await connection();
  const db = getDb();
  const [zones, cities, settings] = await Promise.all([
    db.select().from(s.serviceZones).orderBy(asc(s.serviceZones.sort)),
    db.select().from(s.cityPages).orderBy(asc(s.cityPages.city)),
    loadSettings(db),
  ]);
  const zoneOptions = [{ value: "", label: "—" }, ...zones.map((z) => ({ value: z.id, label: z.name }))];
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-bold">Service area</h1>
      <p className="-mt-6 text-sm text-fg-muted">
        A ZIP match wins; otherwise the smallest radius ring around your base ({settings.base.label}) applies. Travel minutes are added before each mobile job.
      </p>
      <section aria-labelledby="z-h" className="flex flex-col gap-4">
        <h2 id="z-h" className="text-xl font-bold">Zones</h2>
        {[...zones, undefined].map((z) => (
          <div key={z?.id ?? "new"} className="card p-4">
            <ActionForm action={zoneSaveAction} submitLabel={z ? "Save zone" : "Add zone"}>
              <input type="hidden" name="id" value={z?.id ?? ""} />
              <div className="grid gap-3 sm:grid-cols-4">
                <AdminInput label="Name" name="name" defaultValue={z?.name} required />
                <AdminInput label="Radius (km, optional)" name="ringMaxKm" type="number" step="0.1" defaultValue={z?.ringMaxKm ?? ""} />
                <AdminInput label="Travel fee ($)" name="travelFee" type="number" step="0.01" defaultValue={z ? (z.travelFeeCents / 100).toFixed(2) : "0"} />
                <AdminInput label="Travel minutes" name="travelMinutes" type="number" defaultValue={z?.travelMinutes ?? 20} />
              </div>
              <AdminTextarea label="ZIP codes (space or comma separated)" name="zipCodes" defaultValue={z?.zipCodes.join(", ")} rows={2} />
              <AdminInput label="Cities / neighbourhoods (comma separated)" name="cities" defaultValue={z?.cities.join(", ")} />
              <div className="flex gap-4">
                <AdminCheck label="Active" name="active" defaultChecked={z?.active ?? true} />
                <AdminInput label="Sort" name="sort" type="number" defaultValue={z?.sort ?? 0} className="w-24" />
              </div>
            </ActionForm>
          </div>
        ))}
      </section>
      <section aria-labelledby="c-h" className="flex flex-col gap-4">
        <h2 id="c-h" className="text-xl font-bold">City landing pages</h2>
        <p className="text-sm text-fg-muted">Only publish pages with genuinely local content — near-identical city pages can hurt rankings.</p>
        {[...cities, undefined].map((c) => (
          <details key={c?.slug ?? "new"} className="card p-4">
            <summary className="cursor-pointer font-semibold">{c ? `${c.city}, ${c.region}${c.published ? "" : " (draft)"}${c.isPlaceholder ? " · sample" : ""}` : "+ New city page"}</summary>
            <div className="mt-4">
              <ActionForm action={cityPageSaveAction}>
                <div className="grid gap-3 sm:grid-cols-4">
                  <AdminInput label="URL slug" name="slug" defaultValue={c?.slug} required />
                  <AdminInput label="City" name="city" defaultValue={c?.city} required />
                  <AdminInput label="State" name="region" defaultValue={c?.region} required />
                  <AdminSelect label="Zone" name="zoneId" defaultValue={c?.zoneId ?? ""} options={zoneOptions} />
                </div>
                <AdminTextarea label="Intro (local, specific)" name="introMd" defaultValue={c?.introMd} rows={4} />
                <AdminTextarea label="Local notes (parking, HOA rules, landmarks)" name="localNotesMd" defaultValue={c?.localNotesMd} rows={3} />
                <AdminCheck label="Published" name="published" defaultChecked={c?.published ?? false} />
              </ActionForm>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
