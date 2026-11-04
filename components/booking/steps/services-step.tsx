"use client";
import { AlertTriangle, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { RadioCards } from "@/components/ui/radio-cards";
import { noteText } from "@/lib/booking/summary";
import { formatDuration } from "@/lib/domain/money";
import { describePriceError, durationForItem, price, priceForItem } from "@/lib/domain/pricing";
import { priceLabel } from "@/lib/site/pricing-labels";
import { StepShell } from "../step-shell";
import type { StepProps } from "./types";

export function ServicesStep({ state, dispatch, data, onNext, onBack, onSwitchToQuote }: StepProps & { onSwitchToQuote: () => void }) {
  const [touched, setTouched] = useState(false);
  const size = data.catalog.sizes.find((z) => z.id === state.vehicle.sizeId);
  const sel = state.services;
  // A package's own service is picked via the package above, not as a separate line.
  const packageServiceIds = new Set(data.packages.flatMap((p) => p.serviceIds));
  const mains = data.services.filter((s) => s.kind === "service" && !packageServiceIds.has(s.id));
  const addons = data.services.filter((s) => s.kind === "addon");
  const includedInPkg = new Set(data.packages.find((p) => p.id === sel.packageId)?.serviceIds ?? []);

  const result = useMemo(
    () =>
      price(
        { sizeId: state.vehicle.sizeId, packageId: sel.packageId, serviceIds: sel.serviceIds, addonIds: sel.addonIds, conditionIds: state.vehicle.conditionIds },
        { catalog: data.catalog, ...data.pricing, travelFeeCents: 0 },
      ),
    [state.vehicle, sel, data],
  );
  const empty = sel.packageId === null && sel.serviceIds.length === 0;
  const errors = touched || !empty ? result.errors.filter((e) => e.code !== "empty_selection" || touched) : [];
  const quoteReason = result.quoteReasons[0];

  const priceOf = (id: string, kind: "service" | "package") => {
    if (!size) return "";
    const item = kind === "package" ? data.catalog.packages.find((p) => p.id === id) : data.catalog.services.find((s) => s.id === id);
    if (!item) return "";
    // Same wording as the pricing page ("$75", "from $30"), so the price a customer saw there reads the same here.
    return `${priceLabel(item.slug, size.id, priceForItem(item, size, data.pricing.priceRoundingCents))} · ${formatDuration(durationForItem(item, size))}`;
  };

  const toggle = (list: "serviceIds" | "addonIds", id: string, on: boolean) =>
    dispatch({ type: "services", patch: { [list]: on ? [...sel[list], id] : sel[list].filter((x) => x !== id) } });

  return (
    <StepShell
      title="Choose your services"
      intro={size ? `Prices shown for a ${size.label.toLowerCase()}.` : undefined}
      onBack={onBack}
      nextDisabled={result.route === "quote"}
      onNext={() => {
        setTouched(true);
        if (result.ok && result.route === "book") onNext();
        else document.getElementById("services-errors")?.focus();
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-bold">Packages</legend>
        <RadioCards
          label="Package"
          columns={3}
          value={sel.packageId ?? "none"}
          onValueChange={(v) => dispatch({ type: "services", patch: { packageId: v === "none" ? null : v } })}
          options={[
            ...data.packages.map((p) => ({ value: p.id, title: p.featured ? `${p.name} ★` : p.name, description: p.tagline, aside: priceOf(p.id, "package").split(" · ")[0] })),
            { value: "none", title: "No package", description: "Pick individual services below." },
          ]}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-bold">{sel.packageId ? "Add services" : "Services"}</legend>
        <ul className="flex flex-col gap-3">
          {mains.map((s) => {
            const included = includedInPkg.has(s.id);
            return (
              <li key={s.id} className="rounded-2xl border border-white/10 bg-ink-850 p-4">
                <Checkbox
                  id={`svc-${s.id}`}
                  checked={included || sel.serviceIds.includes(s.id)}
                  onCheckedChange={(on) => !included && toggle("serviceIds", s.id, on)}
                  label={
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold">{s.name}</span>
                      <span className="tabular text-sm text-gold-300">{included ? "Included" : s.quoteOnly ? "Quote" : priceOf(s.id, "service")}</span>
                    </span>
                  }
                  description={s.summary}
                />
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-bold">Add-ons</legend>
        <ul className="grid gap-3 sm:grid-cols-2">
          {addons.map((s) => {
            const included = includedInPkg.has(s.id);
            const auto = result.notes.some((n) => n.code === "auto_added" && n.serviceId === s.id);
            return (
              <li key={s.id} className="rounded-2xl border border-white/10 bg-ink-850 p-4">
                <Checkbox
                  id={`add-${s.id}`}
                  checked={included || auto || sel.addonIds.includes(s.id)}
                  onCheckedChange={(on) => !included && !auto && toggle("addonIds", s.id, on)}
                  label={
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold">{s.name}</span>
                      <span className="tabular text-sm text-gold-300">{included ? "Included" : auto ? "Required" : priceOf(s.id, "service").split(" · ")[0]}</span>
                    </span>
                  }
                  description={s.summary}
                />
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div id="services-errors" tabIndex={-1} aria-live="polite" className="flex flex-col gap-3 outline-none">
        {result.notes.map((n) => (
          <p key={noteText(n)} className="flex gap-2 rounded-2xl border border-gold-400/30 bg-gold-500/[0.07] p-4 text-sm text-gold-200">
            <Info className="size-5 shrink-0" aria-hidden="true" /> {noteText(n)}
          </p>
        ))}
        {errors.map((e) => (
          <p key={JSON.stringify(e)} role="alert" className="flex gap-2 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" /> {describePriceError(e)}
          </p>
        ))}
        {quoteReason && (
          <div role="status" className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-ink-800 p-5">
            <p className="font-semibold">
              {quoteReason.code === "quote_only"
                ? "Part of this job is priced individually, so we'll send you a custom quote."
                : `This combination takes about ${formatDuration(quoteReason.durationMin)} — longer than a single day, so we'll schedule it with you personally.`}
            </p>
            <p className="text-sm text-fg-muted">We'll keep your vehicle details. It only takes a minute.</p>
            <Button type="button" className="w-fit" onClick={onSwitchToQuote}>
              Switch to a custom quote
            </Button>
          </div>
        )}
      </div>
    </StepShell>
  );
}
