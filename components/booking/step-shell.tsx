"use client";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shared step layout. On mount, focus moves to the step heading so keyboard and
 * screen-reader users land at the start of the new step.
 */
export function StepShell({
  title,
  intro,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  pending,
  error,
  hideNext,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  pending?: boolean;
  error?: string | null;
  hideNext?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: false });
  }, [title]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!nextDisabled && !pending) onNext?.();
      }}
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <h1 ref={heading} tabIndex={-1} className="text-[clamp(1.7rem,3.4vw,2.4rem)] leading-tight font-bold outline-none">
          {title}
        </h1>
        {intro && <div className="text-fg-muted">{intro}</div>}
      </div>
      {error && (
        <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}
      {children}
      <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden="true" /> Back
          </Button>
        ) : (
          <span />
        )}
        {!hideNext && (
          <Button type="submit" size="lg" disabled={nextDisabled || pending} aria-busy={pending || undefined}>
            {pending ? "Please wait…" : nextLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
