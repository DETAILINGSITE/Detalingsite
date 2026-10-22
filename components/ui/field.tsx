/**
 * Accessible form field primitives: every input gets a visible label, an optional
 * description, and an error announced via aria-describedby + aria-invalid.
 */
import { Checkbox as RCheckbox } from "radix-ui";
import { Check } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full min-h-12 rounded-xl border border-white/12 bg-ink-850 px-4 text-base text-fg placeholder:text-fg-subtle transition-colors focus:border-gold-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-gold-300 aria-[invalid=true]:border-danger";

export function useFieldIds(name: string) {
  const id = useId();
  return { inputId: `${id}-${name}`, descId: `${id}-${name}-desc`, errId: `${id}-${name}-err` };
}

export function Field({
  label,
  htmlFor,
  description,
  descId,
  error,
  errId,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  description?: ReactNode;
  descId?: string;
  error?: string;
  errId?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-fg">
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-gold-300">*</span> : <span className="ml-1.5 font-normal text-fg-subtle">(optional)</span>}
      </label>
      {description && (
        <p id={descId} className="text-sm text-fg-muted">
          {description}
        </p>
      )}
      {children}
      {error && (
        <p id={errId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(ids: { descId?: string; errId?: string }, hasDesc: boolean, hasErr: boolean) {
  return [hasDesc ? ids.descId : null, hasErr ? ids.errId : null].filter(Boolean).join(" ") || undefined;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-32 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23b1b4ba%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_1rem_center] bg-no-repeat pr-10", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  label,
  description,
  invalid,
  describedById,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  invalid?: boolean;
  describedById?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <RCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-white/25 bg-ink-850 data-[state=checked]:border-gold-400 data-[state=checked]:bg-gold-400 aria-[invalid=true]:border-danger"
      >
        <RCheckbox.Indicator>
          <Check className="size-4 text-ink-950" strokeWidth={3} aria-hidden="true" />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-fg-muted">
        <span className="text-fg">{label}</span>
        {description && <span className="mt-1 block">{description}</span>}
      </label>
    </div>
  );
}
