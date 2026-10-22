"use client";
/**
 * Running price summary: sticky sidebar on desktop, collapsible bottom sheet on mobile.
 * Totals are announced politely when they change.
 */
import { ChevronUp } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import type { PriceSummary } from "@/lib/booking/summary";
import { formatDuration, formatMoney } from "@/lib/domain/money";
import { formatDateTimeLong } from "@/lib/domain/time";

export function SummaryBody({ price, when, timezone, where, vehicle }: { price: PriceSummary | null; when: string | null; timezone: string; where: string | null; vehicle: string | null }) {
  if (!price || price.lines.length === 0) {
    return <p className="text-sm text-fg-muted">Your selections and price will appear here.</p>;
  }
  return (
    <div className="flex flex-col gap-4 text-sm">
      {(vehicle || where || when) && (
        <dl className="flex flex-col gap-1.5 text-fg-muted">
          {vehicle && (
            <div className="flex justify-between gap-3">
              <dt>Vehicle</dt>
              <dd className="text-right text-fg">{vehicle}</dd>
            </div>
          )}
          {where && (
            <div className="flex justify-between gap-3">
              <dt>Where</dt>
              <dd className="text-right text-fg">{where}</dd>
            </div>
          )}
          {when && (
            <div className="flex justify-between gap-3">
              <dt>When</dt>
              <dd className="text-right text-fg">{formatDateTimeLong(Date.parse(when), timezone)}</dd>
            </div>
          )}
        </dl>
      )}
      <ul className="flex flex-col gap-2 border-t border-white/[0.08] pt-4">
        {price.lines
          .filter((l) => l.kind !== "tax")
          .map((l, i) => (
            <li key={`${l.kind}-${l.id ?? i}`} className="flex justify-between gap-3">
              <span className="text-fg-muted">
                {l.label}
                {l.note && <span className="block text-xs text-gold-300">{l.note}</span>}
              </span>
              <span className="tabular shrink-0">{l.amountCents < 0 ? `−${formatMoney(-l.amountCents)}` : formatMoney(l.amountCents)}</span>
            </li>
          ))}
        {price.taxCents > 0 && (
          <li className="flex justify-between gap-3">
            <span className="text-fg-muted">Tax</span>
            <span className="tabular">{formatMoney(price.taxCents)}</span>
          </li>
        )}
      </ul>
      <div className="flex flex-col gap-1.5 border-t border-white/[0.08] pt-4" aria-live="polite">
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span className="tabular">{formatMoney(price.totalCents)}</span>
        </div>
        {price.depositCents > 0 && (
          <>
            <div className="flex justify-between text-fg-muted">
              <span>Deposit due today</span>
              <span className="tabular">{formatMoney(price.depositCents)}</span>
            </div>
            <div className="flex justify-between text-fg-muted">
              <span>Balance at appointment</span>
              <span className="tabular">{formatMoney(price.balanceCents)}</span>
            </div>
          </>
        )}
        <p className="text-fg-subtle">Estimated time: {formatDuration(price.durationMin)}</p>
      </div>
      {price.notes.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-xl bg-gold-500/[0.07] p-3 text-xs text-gold-200">
          {price.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Summary(props: Parameters<typeof SummaryBody>[0]) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside aria-label="Booking summary" className="sticky top-[calc(var(--header-h)+1.5rem)] hidden self-start lg:block">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-bold">Summary</h2>
          <SummaryBody {...props} />
        </div>
      </aside>

      {/* Mobile: collapsed bar with the total, expands into a bottom sheet. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-850/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="flex min-h-14 w-full items-center justify-between px-4 text-left" aria-label="Show booking summary">
            <span className="text-sm text-fg-muted">Total</span>
            <span className="flex items-center gap-2 font-bold">
              <span className="tabular" aria-live="polite">{props.price && props.price.lines.length ? formatMoney(props.price.totalCents) : "—"}</span>
              <ChevronUp className="size-5" aria-hidden="true" />
            </span>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 data-[state=open]:animate-fade-in" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-[101] max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink-850 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] data-[state=open]:animate-fade-in">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" aria-hidden="true" />
              <Dialog.Title className="mb-4 text-lg font-bold">Summary</Dialog.Title>
              <Dialog.Description className="sr-only">Your selections and price</Dialog.Description>
              <SummaryBody {...props} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </>
  );
}
