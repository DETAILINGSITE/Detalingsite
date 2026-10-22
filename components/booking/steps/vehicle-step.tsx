"use client";
import { useState } from "react";
import { Checkbox, Field, Input, describedBy, useFieldIds } from "@/components/ui/field";
import { RadioCards } from "@/components/ui/radio-cards";
import { formatMoney } from "@/lib/domain/money";
import { VehicleSchema } from "@/lib/validation/booking";
import { StepShell } from "../step-shell";
import type { StepProps } from "./types";

export function VehicleStep({ state, dispatch, data, onNext, onBack }: StepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const v = state.vehicle;
  const year = useFieldIds("year");
  const make = useFieldIds("make");
  const model = useFieldIds("model");
  const color = useFieldIds("color");
  const soil = data.conditions.filter((c) => c.group === "soil");
  const extras = data.conditions.filter((c) => c.group === "extra");
  const soilId = v.conditionIds.find((id) => soil.some((c) => c.id === id)) ?? null;
  const surchargeLabel = (id: string) => {
    const c = data.catalog.conditions.find((x) => x.id === id);
    if (!c || c.surchargeValue === 0) return undefined;
    return c.surchargeType === "flat" ? `+${formatMoney(c.surchargeValue)}` : `+${c.surchargeValue}%`;
  };

  const next = () => {
    const parsed = VehicleSchema.safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      const firstId = errs.sizeId ? "vehicle-size" : errs.year ? year.inputId : null;
      if (firstId) document.getElementById(firstId)?.focus();
      return;
    }
    setErrors({});
    onNext();
  };

  return (
    <StepShell title="Tell us about your vehicle" intro="Size sets the price; the details help us prepare." onNext={next} onBack={onBack}>
      <fieldset className="flex flex-col gap-3" aria-describedby={errors.sizeId ? "size-err" : undefined}>
        <legend className="mb-1 text-sm font-semibold">
          Vehicle size <span aria-hidden="true" className="text-gold-300">*</span>
        </legend>
        <div id="vehicle-size" tabIndex={-1}>
          <RadioCards
            label="Vehicle size"
            columns={2}
            invalid={!!errors.sizeId}
            value={v.sizeId || null}
            onValueChange={(sizeId) => dispatch({ type: "vehicle", patch: { sizeId } })}
            options={data.sizes.map((z) => ({ value: z.id, title: z.label, description: z.description }))}
          />
        </div>
        {errors.sizeId && (
          <p id="size-err" role="alert" className="text-sm font-medium text-danger">
            {errors.sizeId}
          </p>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Year" htmlFor={year.inputId} error={errors.year} errId={year.errId}>
          <Input id={year.inputId} inputMode="numeric" maxLength={4} value={v.year} onChange={(e) => dispatch({ type: "vehicle", patch: { year: e.target.value.replace(/\D/g, "") } })} aria-invalid={!!errors.year || undefined} aria-describedby={describedBy(year, false, !!errors.year)} />
        </Field>
        <Field label="Make" htmlFor={make.inputId}>
          <Input id={make.inputId} autoComplete="off" value={v.make} onChange={(e) => dispatch({ type: "vehicle", patch: { make: e.target.value } })} placeholder="e.g. Toyota" />
        </Field>
        <Field label="Model" htmlFor={model.inputId}>
          <Input id={model.inputId} autoComplete="off" value={v.model} onChange={(e) => dispatch({ type: "vehicle", patch: { model: e.target.value } })} placeholder="e.g. RAV4" />
        </Field>
        <Field label="Colour" htmlFor={color.inputId}>
          <Input id={color.inputId} autoComplete="off" value={v.color} onChange={(e) => dispatch({ type: "vehicle", patch: { color: e.target.value } })} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">
          How dirty is it? <span className="font-normal text-fg-subtle">(optional)</span>
        </legend>
        <RadioCards
          label="Condition"
          columns={3}
          value={soilId}
          onValueChange={(id) =>
            dispatch({ type: "vehicle", patch: { conditionIds: [...v.conditionIds.filter((c) => !soil.some((s) => s.id === c)), id] } })
          }
          options={soil.map((c) => ({ value: c.id, title: c.label, description: c.description, aside: surchargeLabel(c.id) }))}
        />
        <div className="mt-2 flex flex-col gap-3">
          {extras.map((c) => (
            <Checkbox
              key={c.id}
              id={`cond-${c.id}`}
              checked={v.conditionIds.includes(c.id)}
              onCheckedChange={(on) =>
                dispatch({ type: "vehicle", patch: { conditionIds: on ? [...v.conditionIds, c.id] : v.conditionIds.filter((x) => x !== c.id) } })
              }
              label={
                <>
                  {c.label} {surchargeLabel(c.id) && <span className="tabular text-gold-300">{surchargeLabel(c.id)}</span>}
                </>
              }
              description={c.description}
            />
          ))}
        </div>
      </fieldset>
    </StepShell>
  );
}
