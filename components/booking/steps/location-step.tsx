"use client";
import { MapPinOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea, describedBy, useFieldIds } from "@/components/ui/field";
import { RadioCards } from "@/components/ui/radio-cards";
import { formatMoney } from "@/lib/domain/money";
import { AddressSchema } from "@/lib/validation/booking";
import { AddressAutocomplete } from "../address-autocomplete";
import { StepShell } from "../step-shell";
import type { StepProps } from "./types";

export function LocationStep({ state, dispatch, data, onNext, onBack, onSwitchToQuote, allowOutOfArea }: StepProps & { onSwitchToQuote: () => void; allowOutOfArea: boolean }) {
  const loc = state.location;
  const a = loc.address;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outOfArea, setOutOfArea] = useState(false);
  const f = { line1: useFieldIds("line1"), line2: useFieldIds("line2"), city: useFieldIds("city"), region: useFieldIds("region"), postalCode: useFieldIds("zip"), notes: useFieldIds("notes") };
  const forcedType = data.serviceMode === "both" ? null : data.serviceMode;
  const locationType = forcedType ?? loc.locationType;
  const zone = data.zones.find((z) => z.zipCodes.includes(a.postalCode.slice(0, 5)));

  const setAddr = (patch: Partial<typeof a>) => {
    setOutOfArea(false);
    dispatch({ type: "location", patch: { address: { ...a, ...patch } } });
  };

  const next = () => {
    if (!locationType) return setErrors({ type: "Choose where you'd like the work done." });
    if (forcedType && loc.locationType !== forcedType) dispatch({ type: "location", patch: { locationType: forcedType } });
    if (locationType === "shop") {
      setErrors({});
      return onNext();
    }
    const parsed = AddressSchema.safeParse({ ...a, line2: a.line2 || undefined, country: "US" });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      const first = (["line1", "city", "region", "postalCode"] as const).find((k) => errs[k]);
      if (first) document.getElementById(f[first].inputId)?.focus();
      return;
    }
    setErrors({});
    // Quick ZIP check; radius zones are confirmed by the server when times are loaded.
    if (!zone && !(a.lat != null && a.lng != null) && !allowOutOfArea) {
      setOutOfArea(true);
      return;
    }
    onNext();
  };

  const err = (k: keyof typeof f) => errors[k];

  return (
    <StepShell title="Where should we do the work?" onNext={next} onBack={onBack} error={errors.type}>
      {!forcedType && (
        <RadioCards
          label="Service location"
          value={loc.locationType}
          onValueChange={(v) => {
            setErrors({});
            dispatch({ type: "location", patch: { locationType: v as "mobile" | "shop" } });
          }}
          options={[
            { value: "mobile", title: "Come to me", description: "Home, office or anywhere with room to work." },
            ...(data.shop.enabled ? [{ value: "shop", title: "At your shop", description: data.shop.label }] : []),
          ]}
        />
      )}

      {locationType === "shop" && (
        <div className="card flex flex-col gap-2 p-5">
          <p className="font-semibold">Our shop</p>
          <p className="text-fg-muted">{data.shop.label}</p>
          <a href={data.shop.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-gold-300 underline">
            Open in Google Maps
          </a>
        </div>
      )}

      {locationType === "mobile" && (
        <div className="flex flex-col gap-5">
          <Field label="Street address" htmlFor={f.line1.inputId} error={err("line1")} errId={f.line1.errId} required>
            <AddressAutocomplete
              id={f.line1.inputId}
              enabled={data.placesAvailable}
              value={a.line1}
              invalid={!!err("line1")}
              describedById={describedBy(f.line1, false, !!err("line1"))}
              onChange={(line1) => setAddr({ line1, lat: undefined, lng: undefined, placeId: undefined })}
              onPick={(p) => setAddr({ line1: p.line1, city: p.city, region: p.region, postalCode: p.postalCode, lat: p.lat, lng: p.lng, placeId: p.placeId })}
            />
          </Field>
          <Field label="Apartment, suite, etc." htmlFor={f.line2.inputId}>
            <Input id={f.line2.inputId} autoComplete="address-line2" value={a.line2} onChange={(e) => setAddr({ line2: e.target.value })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
            <Field label="City" htmlFor={f.city.inputId} error={err("city")} errId={f.city.errId} required>
              <Input id={f.city.inputId} autoComplete="address-level2" value={a.city} onChange={(e) => setAddr({ city: e.target.value })} aria-invalid={!!err("city") || undefined} aria-describedby={describedBy(f.city, false, !!err("city"))} />
            </Field>
            <Field label="State" htmlFor={f.region.inputId} error={err("region")} errId={f.region.errId} required>
              <Input id={f.region.inputId} autoComplete="address-level1" value={a.region} onChange={(e) => setAddr({ region: e.target.value })} aria-invalid={!!err("region") || undefined} aria-describedby={describedBy(f.region, false, !!err("region"))} />
            </Field>
            <Field label="ZIP" htmlFor={f.postalCode.inputId} error={err("postalCode")} errId={f.postalCode.errId} required>
              <Input id={f.postalCode.inputId} inputMode="numeric" autoComplete="postal-code" maxLength={10} value={a.postalCode} onChange={(e) => setAddr({ postalCode: e.target.value })} aria-invalid={!!err("postalCode") || undefined} aria-describedby={describedBy(f.postalCode, false, !!err("postalCode"))} />
            </Field>
          </div>
          {zone && (
            <p className="text-sm text-success" aria-live="polite">
              ✓ We cover this area ({zone.name}){zone.travelFeeCents ? ` · travel fee ${formatMoney(zone.travelFeeCents)}` : ""}.
            </p>
          )}
          <Field label="Access notes" htmlFor={f.notes.inputId} description="Gate codes, parking, where the car will be." descId={f.notes.descId}>
            <Textarea id={f.notes.inputId} className="min-h-24" maxLength={500} value={loc.accessNotes} onChange={(e) => dispatch({ type: "location", patch: { accessNotes: e.target.value } })} aria-describedby={f.notes.descId} />
          </Field>
          <div className="flex flex-col gap-3">
            <Checkbox id="has-water" checked={loc.hasWater} onCheckedChange={(hasWater) => dispatch({ type: "location", patch: { hasWater } })} label="There's an outdoor water tap we can use" description="Not required — we carry water." />
            <Checkbox id="has-power" checked={loc.hasPower} onCheckedChange={(hasPower) => dispatch({ type: "location", patch: { hasPower } })} label="There's a power outlet within 30 m" description="Not required — we carry a generator." />
          </div>
        </div>
      )}

      {outOfArea && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-5">
          <p className="flex items-center gap-2 font-semibold text-warning">
            <MapPinOff className="size-5" aria-hidden="true" /> That address is outside our regular service area.
          </p>
          <p className="text-sm text-fg-muted">
            We may still be able to help. Send us a quote request and we'll get back to you{data.shop.enabled ? " — or choose our shop instead" : ""}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onSwitchToQuote}>
              Request a quote anyway
            </Button>
            <a href={`tel:${data.phone}`} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-gold-300 underline">
              Call {data.phoneDisplay}
            </a>
          </div>
        </div>
      )}
    </StepShell>
  );
}
