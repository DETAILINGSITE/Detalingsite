"use client";
import { RadioGroup } from "radix-ui";
import type { ReactNode } from "react";
// clsx, not cn(): no conflicting utilities here, and it keeps tailwind-merge off the client.
import { clsx as cn } from "clsx";

export interface RadioCardOption {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
}

/** Large tappable radio options (≥44px), fully keyboard operable via Radix RadioGroup. */
export function RadioCards({
  value,
  onValueChange,
  options,
  label,
  className,
  columns = 2,
  invalid,
  describedBy,
  name,
}: {
  value: string | null;
  onValueChange: (v: string) => void;
  options: RadioCardOption[];
  label: string;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
  invalid?: boolean;
  describedBy?: string;
  name?: string;
}) {
  return (
    <RadioGroup.Root
      value={value ?? ""}
      onValueChange={onValueChange}
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      name={name}
      className={cn(
        "grid gap-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "group relative flex min-h-16 w-full items-start gap-3 rounded-2xl border border-white/10 bg-ink-850 p-4 text-left transition-[border-color,background-color,transform] duration-200",
            "hover:border-white/25 data-[state=checked]:border-gold-400 data-[state=checked]:bg-gold-500/[0.07]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span
            aria-hidden="true"
            className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/30 group-data-[state=checked]:border-gold-400"
          >
            <RadioGroup.Indicator className="size-2.5 rounded-full bg-gold-400" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-fg">{o.title}</span>
              {o.aside && <span className="tabular shrink-0 text-sm font-semibold text-gold-300">{o.aside}</span>}
            </span>
            {o.description && <span className="text-sm leading-relaxed text-fg-muted">{o.description}</span>}
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
