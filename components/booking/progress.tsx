import { STEP_LABELS, type StepId } from "@/lib/booking/wizard-state";
import { cn } from "@/lib/utils";

/** Visible progress with a text equivalent ("Step 3 of 7"). */
export function Progress({ steps, current }: { steps: StepId[]; current: StepId }) {
  const visible = steps.filter((s) => s !== "submitted");
  const idx = Math.max(0, visible.indexOf(current));
  const pct = ((idx + 1) / visible.length) * 100;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <p className="font-semibold text-fg">
          Step {idx + 1} of {visible.length}: {STEP_LABELS[current]}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Booking progress"
        aria-valuemin={1}
        aria-valuemax={visible.length}
        aria-valuenow={idx + 1}
        aria-valuetext={`Step ${idx + 1} of ${visible.length}: ${STEP_LABELS[current]}`}
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
      >
        <div className="h-full origin-left rounded-full bg-[var(--brand)] transition-transform duration-500" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <ol className="hidden gap-2 text-xs text-fg-subtle md:flex">
        {visible.map((s, i) => (
          <li key={s} className={cn("flex-1 truncate", i <= idx && "text-fg-muted", i === idx && "font-semibold text-gold-300")} aria-current={i === idx ? "step" : undefined}>
            {STEP_LABELS[s]}
          </li>
        ))}
      </ol>
    </div>
  );
}
