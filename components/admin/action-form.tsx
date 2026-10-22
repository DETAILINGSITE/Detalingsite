"use client";
import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; message?: string } | null;

/** Wraps an admin Server Action: pending state + announced success/error message. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  variant = "primary",
  confirm,
}: {
  action: (fd: FormData) => Promise<Result>;
  children?: ReactNode;
  submitLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(async (_: Result, fd: FormData) => action(fd), null);
  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-4", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={variant} size="sm" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <p role="status" aria-live="polite" className={cn("text-sm", state?.ok === false ? "text-danger" : "text-success")}>
          {state?.message ?? (state?.ok ? "Done." : "")}
        </p>
      </div>
    </form>
  );
}

export function AdminInput({ label, name, defaultValue, type = "text", required, step, placeholder, className }: { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; step?: string; placeholder?: string; className?: string }) {
  const id = `f-${name}`;
  return (
    <label htmlFor={id} className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <span className="font-semibold">{label}</span>
      <input id={id} name={name} type={type} step={step} required={required} placeholder={placeholder} defaultValue={defaultValue ?? ""} className="min-h-11 rounded-xl border border-white/12 bg-ink-850 px-3 text-fg focus:border-gold-400" />
    </label>
  );
}

export function AdminCheck({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-5 accent-[var(--brand)]" />
      {label}
    </label>
  );
}

export function AdminTextarea({ label, name, defaultValue, rows = 3 }: { label: string; name: string; defaultValue?: string | null; rows?: number }) {
  const id = `f-${name}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <textarea id={id} name={name} rows={rows} defaultValue={defaultValue ?? ""} className="rounded-xl border border-white/12 bg-ink-850 p-3 text-fg focus:border-gold-400" />
    </label>
  );
}

export function AdminSelect({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string | null; options: { value: string; label: string }[] }) {
  const id = `f-${name}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <select id={id} name={name} defaultValue={defaultValue ?? ""} className="min-h-11 rounded-xl border border-white/12 bg-ink-850 px-3 text-fg">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
