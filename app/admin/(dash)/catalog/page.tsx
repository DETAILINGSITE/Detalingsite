import { connection } from "next/server";
import { ActionForm, AdminCheck, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import { formatMoney } from "@/lib/domain/money";
import { loadCatalog } from "@/lib/server/data/catalog";
import { conditionSaveAction, packageSaveAction, ruleAddAction, ruleDeleteAction, serviceSaveAction, sizeSaveAction } from "../actions";

/** Owner-editable catalog. Blank per-size fields fall back to base × size multiplier. */
export default async function CatalogPage() {
  await connection();
  const cat = await loadCatalog(getDb());
  const svcName = new Map(cat.services.map((s) => [s.id, s.name]));
  const catOptions = [{ value: "", label: "—" }, ...cat.categories.map((c) => ({ value: c.id, label: c.name }))];

  const SizeOverrides = ({ overrides }: { overrides: Record<string, { priceCents?: number | null; durationMin?: number | null }> }) => (
    <fieldset className="grid gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <legend className="px-1 text-xs text-fg-subtle">Per-size overrides (optional)</legend>
      {cat.sizes.map((z) => (
        <div key={z.id} className="flex flex-col gap-2">
          <span className="text-xs font-semibold">{z.label}</span>
          <AdminInput label="Price ($)" name={`price_${z.id}`} type="number" step="0.01" defaultValue={overrides[z.id]?.priceCents != null ? ((overrides[z.id]?.priceCents ?? 0) / 100).toFixed(2) : ""} />
          <AdminInput label="Minutes" name={`dur_${z.id}`} type="number" defaultValue={overrides[z.id]?.durationMin ?? ""} />
        </div>
      ))}
    </fieldset>
  );

  const ServiceForm = ({ s }: { s?: (typeof cat.services)[number] }) => (
    <ActionForm action={serviceSaveAction}>
      <input type="hidden" name="id" value={s?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminInput label="Name" name="name" defaultValue={s?.name} required />
        <AdminInput label="URL slug" name="slug" defaultValue={s?.slug} required />
        <AdminSelect label="Type" name="kind" defaultValue={s?.kind ?? "service"} options={[{ value: "service", label: "Service" }, { value: "addon", label: "Add-on" }]} />
        <AdminSelect label="Category" name="categoryId" defaultValue={s?.categoryId ?? ""} options={catOptions} />
        <AdminInput label="Base price ($)" name="basePrice" type="number" step="0.01" defaultValue={s ? (s.basePriceCents / 100).toFixed(2) : ""} required />
        <AdminInput label="Base duration (min)" name="baseDurationMin" type="number" defaultValue={s?.baseDurationMin} required />
      </div>
      <AdminInput label="Summary" name="summary" defaultValue={s?.summary} />
      <AdminTextarea label="Description" name="descriptionMd" defaultValue={s?.descriptionMd} />
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminTextarea label="What's included (one per line)" name="includes" defaultValue={s?.includes.join("\n")} />
        <AdminTextarea label="What to expect (one per line)" name="whatToExpect" defaultValue={s?.whatToExpect.join("\n")} />
      </div>
      <div className="flex flex-wrap gap-4">
        <AdminCheck label="Mobile" name="mobile" defaultChecked={s ? s.locationTypes.includes("mobile") : true} />
        <AdminCheck label="In-shop" name="shop" defaultChecked={s ? s.locationTypes.includes("shop") : true} />
        <AdminCheck label="Quote only" name="quoteOnly" defaultChecked={s?.quoteOnly} />
        <AdminCheck label="Active" name="active" defaultChecked={s?.active ?? true} />
        <AdminInput label="Sort" name="sort" type="number" defaultValue={s?.sort ?? 0} className="w-24" />
      </div>
      <SizeOverrides overrides={s?.sizeOverrides ?? {}} />
    </ActionForm>
  );

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-bold">Catalog</h1>

      <section aria-labelledby="sizes-h" className="flex flex-col gap-4">
        <h2 id="sizes-h" className="text-xl font-bold">Vehicle sizes & multipliers</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {cat.sizes.map((z) => (
            <div key={z.id} className="card p-4">
              <ActionForm action={sizeSaveAction}>
                <input type="hidden" name="id" value={z.id} />
                <div className="grid gap-3 sm:grid-cols-4">
                  <AdminInput label="Label" name="label" defaultValue={z.label} />
                  <AdminInput label="Price ×" name="priceMultiplier" type="number" step="0.01" defaultValue={z.priceMultiplier} />
                  <AdminInput label="Time ×" name="durationMultiplier" type="number" step="0.01" defaultValue={z.durationMultiplier} />
                  <AdminInput label="Sort" name="sort" type="number" defaultValue={z.sort} />
                </div>
                <AdminCheck label="Active" name="active" defaultChecked />
              </ActionForm>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="pk-h" className="flex flex-col gap-4">
        <h2 id="pk-h" className="text-xl font-bold">Packages</h2>
        {[...cat.packages, undefined].map((p) => (
          <details key={p?.id ?? "new"} className="card p-4">
            <summary className="cursor-pointer font-semibold">{p ? `${p.name} · ${formatMoney(p.basePriceCents)}${p.active ? "" : " (inactive)"}` : "+ New package"}</summary>
            <div className="mt-4">
              <ActionForm action={packageSaveAction}>
                <input type="hidden" name="id" value={p?.id ?? ""} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminInput label="Name" name="name" defaultValue={p?.name} required />
                  <AdminInput label="URL slug" name="slug" defaultValue={p?.slug} required />
                  <AdminInput label="Tier" name="tier" type="number" defaultValue={p?.tier ?? 1} />
                  <AdminInput label="Base price ($)" name="basePrice" type="number" step="0.01" defaultValue={p ? (p.basePriceCents / 100).toFixed(2) : ""} required />
                  <AdminInput label="Base duration (min)" name="baseDurationMin" type="number" defaultValue={p?.baseDurationMin} required />
                  <AdminInput label="Sort" name="sort" type="number" defaultValue={p?.sort ?? 0} />
                </div>
                <AdminInput label="Tagline" name="tagline" defaultValue={p?.tagline} />
                <fieldset className="flex flex-wrap gap-x-5">
                  <legend className="mb-1 text-sm font-semibold">Included services</legend>
                  {cat.services.map((s) => (
                    <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={p?.serviceIds.includes(s.id)} className="size-5 accent-[var(--brand)]" />
                      {s.name}
                    </label>
                  ))}
                </fieldset>
                <div className="flex gap-4">
                  <AdminCheck label="Featured" name="featured" defaultChecked={p?.featured} />
                  <AdminCheck label="Active" name="active" defaultChecked={p?.active ?? true} />
                </div>
                <SizeOverrides overrides={p?.sizeOverrides ?? {}} />
              </ActionForm>
            </div>
          </details>
        ))}
      </section>

      <section aria-labelledby="svc-h" className="flex flex-col gap-4">
        <h2 id="svc-h" className="text-xl font-bold">Services & add-ons</h2>
        {[...cat.services, undefined].map((s) => (
          <details key={s?.id ?? "new"} className="card p-4">
            <summary className="cursor-pointer font-semibold">
              {s ? `${s.name} · ${s.kind} · ${s.quoteOnly ? "quote" : formatMoney(s.basePriceCents)}${s.active ? "" : " (inactive)"}${s.isPlaceholder ? " · sample price" : ""}` : "+ New service"}
            </summary>
            <div className="mt-4">
              <ServiceForm s={s} />
            </div>
          </details>
        ))}
      </section>

      <section aria-labelledby="rules-h" className="flex flex-col gap-4">
        <h2 id="rules-h" className="text-xl font-bold">Rules</h2>
        <p className="text-sm text-fg-muted">“Requires” auto-adds a prerequisite (with your explanation). “Can’t combine with” blocks a combination.</p>
        <ul className="flex flex-col gap-2">
          {cat.rules.map((r, i) => (
            <li key={i} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span>
                <strong>{svcName.get(r.serviceId)}</strong> {r.kind === "requires" ? "requires" : "can't combine with"} <strong>{svcName.get(r.targetServiceId)}</strong> — {r.reason}
              </span>
              <RuleDelete rule={r} />
            </li>
          ))}
        </ul>
        <div className="card p-4">
          <ActionForm action={ruleAddAction} submitLabel="Add rule">
            <div className="grid gap-3 sm:grid-cols-3">
              <AdminSelect label="Service" name="serviceId" options={cat.services.map((s) => ({ value: s.id, label: s.name }))} />
              <AdminSelect label="Rule" name="kind" options={[{ value: "requires", label: "requires" }, { value: "excludes", label: "can't combine with" }]} />
              <AdminSelect label="Other service" name="targetServiceId" options={cat.services.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
            <AdminInput label="Explanation shown to customers" name="reason" required />
          </ActionForm>
        </div>
      </section>

      <section aria-labelledby="cond-h" className="flex flex-col gap-4">
        <h2 id="cond-h" className="text-xl font-bold">Condition surcharges</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {cat.conditions.map((c) => (
            <div key={c.id} className="card p-4">
              <ActionForm action={conditionSaveAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="group" value={c.group} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminInput label="Label" name="label" defaultValue={c.label} />
                  <AdminSelect label="Surcharge type" name="surchargeType" defaultValue={c.surchargeType} options={[{ value: "flat", label: "Flat ($)" }, { value: "percent", label: "Percent (%)" }]} />
                  <AdminInput label="Amount ($ or %)" name="surchargeValue" type="number" step="0.01" defaultValue={c.surchargeType === "flat" ? (c.surchargeValue / 100).toFixed(2) : c.surchargeValue} />
                  <AdminInput label="Extra minutes" name="extraMinutes" type="number" defaultValue={c.extraMinutes} />
                </div>
                <AdminInput label="Description" name="description" defaultValue={c.description} />
                <input type="hidden" name="sort" value={c.sort} />
                <AdminCheck label="Active" name="active" defaultChecked />
              </ActionForm>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  function RuleDelete({ rule }: { rule: (typeof cat.rules)[number] }) {
    const id = rule.id;
    if (!id) return null;
    return (
      <ActionForm action={ruleDeleteAction} submitLabel="Remove" variant="ghost">
        <input type="hidden" name="id" value={id} />
      </ActionForm>
    );
  }
}
