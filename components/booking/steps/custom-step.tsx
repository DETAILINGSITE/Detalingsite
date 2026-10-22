"use client";
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, describedBy, useFieldIds } from "@/components/ui/field";
import { BUDGET_LABELS, BUDGET_RANGES } from "@/lib/validation/booking";
import { PhotoUploader } from "../photo-uploader";
import { StepShell } from "../step-shell";
import type { StepProps } from "./types";

export function CustomStep({ state, dispatch, data, onNext, onBack }: StepProps) {
  const c = state.custom;
  const [error, setError] = useState<string | null>(null);
  const desc = useFieldIds("desc");
  const date = useFieldIds("date");
  const budget = useFieldIds("budget");
  const [pendingDate, setPendingDate] = useState("");
  const quoteOnly = data.services.filter((s) => s.quoteOnly);

  const next = () => {
    if (c.description.trim().length < 20) {
      setError("Tell us a bit more — at least 20 characters.");
      document.getElementById(desc.inputId)?.focus();
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <StepShell title="Describe your job" intro="The more detail and photos, the more accurate our quote." onNext={next} onBack={onBack}>
      {quoteOnly.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">What's it for? <span className="font-normal text-fg-subtle">(optional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {quoteOnly.map((s) => {
              const on = state.services.serviceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => dispatch({ type: "services", patch: { serviceIds: on ? state.services.serviceIds.filter((x) => x !== s.id) : [...state.services.serviceIds, s.id] } })}
                  className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold aria-pressed:border-gold-400 aria-pressed:bg-gold-500/10 aria-pressed:text-gold-200"
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <Field label="Job description" htmlFor={desc.inputId} description="Condition, what you'd like done, any deadlines." descId={desc.descId} error={error ?? undefined} errId={desc.errId} required>
        <Textarea
          id={desc.inputId}
          value={c.description}
          maxLength={2000}
          onChange={(e) => dispatch({ type: "custom", patch: { description: e.target.value } })}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(desc, true, !!error)}
        />
      </Field>
      {data.uploadsAvailable ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Photos <span className="font-normal text-fg-subtle">(optional)</span></p>
          <PhotoUploader uploadSessionId={c.uploadSessionId} photoIds={c.photoIds} onChange={(photoIds) => dispatch({ type: "custom", patch: { photoIds } })} />
        </div>
      ) : (
        <p className="rounded-2xl bg-ink-850 p-4 text-sm text-fg-muted">Photo uploads aren't available right now — a detailed description works too, or text photos to {data.phoneDisplay}.</p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Preferred dates" htmlFor={date.inputId} description="Add up to 5." descId={date.descId}>
          <div className="flex gap-2">
            <Input id={date.inputId} type="date" value={pendingDate} onChange={(e) => setPendingDate(e.target.value)} aria-describedby={date.descId} />
            <Button
              type="button"
              variant="secondary"
              disabled={!pendingDate || c.preferredDates.length >= 5 || c.preferredDates.includes(pendingDate)}
              onClick={() => {
                dispatch({ type: "custom", patch: { preferredDates: [...c.preferredDates, pendingDate].sort() } });
                setPendingDate("");
              }}
            >
              Add
            </Button>
          </div>
          {c.preferredDates.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {c.preferredDates.map((d) => (
                <li key={d} className="flex items-center gap-1 rounded-full border border-white/15 py-1 pr-1 pl-3 text-sm">
                  {d}
                  <button type="button" className="flex size-8 items-center justify-center rounded-full hover:bg-white/10" aria-label={`Remove ${d}`} onClick={() => dispatch({ type: "custom", patch: { preferredDates: c.preferredDates.filter((x) => x !== d) } })}>
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Budget range" htmlFor={budget.inputId}>
          <Select id={budget.inputId} value={c.budgetRange} onChange={(e) => dispatch({ type: "custom", patch: { budgetRange: e.target.value } })}>
            <option value="">Prefer not to say</option>
            {BUDGET_RANGES.map((b) => (
              <option key={b} value={b}>
                {BUDGET_LABELS[b]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </StepShell>
  );
}
