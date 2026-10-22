"use client";
/** Reschedule (re-runs availability) and cancel (fee shown before confirming). */
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { cancelAction, cancelPreviewAction, manageAvailabilityAction, rescheduleAction } from "@/app/(flow)/booking/[token]/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { RadioCards } from "@/components/ui/radio-cards";
import { formatMoney } from "@/lib/domain/money";
import { formatDateLong } from "@/lib/domain/time";

interface Day {
  date: string;
  slots: { start: string; label: string }[];
}

export function ManageActions({ token, timezone, canReschedule, rescheduleNote }: { token: string; timezone: string; canReschedule: boolean; rescheduleNote: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "reschedule" | "cancel">("none");
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ late: boolean; feeCents: number; refundCents: number; windowHours: number; depositPaidCents: number } | null>(null);
  const [reason, setReason] = useState("");

  const openReschedule = async () => {
    setMode("reschedule");
    setMsg(null);
    const res = await manageAvailabilityAction({ token });
    if (res.ok && "days" in res) {
      setDays(res.days);
      setDate(res.days[0]?.date ?? null);
    } else setMsg("message" in res ? res.message : "Couldn't load times.");
  };

  const openCancel = async () => {
    setMode("cancel");
    setMsg(null);
    const res = await cancelPreviewAction({ token });
    if (res.ok && "feeCents" in res) setPreview(res);
    else setMsg("message" in res ? res.message : "Couldn't load the cancellation details.");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {canReschedule ? (
          <Button variant="secondary" onClick={() => void openReschedule()}>
            Reschedule
          </Button>
        ) : (
          rescheduleNote && <p className="text-sm text-fg-muted">{rescheduleNote}</p>
        )}
        <Button variant="danger" onClick={() => void openCancel()}>
          Cancel booking
        </Button>
      </div>

      <Dialog.Root open={mode !== "none"} onOpenChange={(o) => !o && setMode("none")}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 data-[state=open]:animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[101] max-h-[90dvh] w-[min(40rem,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-ink-850 p-6">
            <Dialog.Title className="text-xl font-bold">{mode === "cancel" ? "Cancel booking" : "Choose a new time"}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-fg-muted">
              {mode === "cancel" ? "Please review what happens to your deposit." : "Your current time is released once the new one is confirmed."}
            </Dialog.Description>
            {msg && <p role="alert" className="mt-4 text-sm text-danger">{msg}</p>}

            {mode === "reschedule" && days && (
              <div className="mt-5 flex flex-col gap-5">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Available days">
                  {days.slice(0, 21).map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      aria-pressed={date === d.date}
                      onClick={() => {
                        setDate(d.date);
                        setSlot(null);
                      }}
                      className="min-h-11 rounded-xl border border-white/10 px-3 text-sm aria-pressed:border-gold-400 aria-pressed:bg-gold-500/10"
                    >
                      {formatDateLong(Date.parse(`${d.date}T12:00:00Z`), "UTC").split(",").slice(0, 2).join(",")}
                    </button>
                  ))}
                </div>
                {date && (
                  <RadioCards
                    label="Available times"
                    columns={3}
                    value={slot}
                    onValueChange={setSlot}
                    options={(days.find((d) => d.date === date)?.slots ?? []).map((s) => ({ value: s.start, title: s.label }))}
                  />
                )}
                <Button
                  disabled={!slot || busy}
                  onClick={async () => {
                    if (!slot) return;
                    setBusy(true);
                    const r = await rescheduleAction({ token, slotStart: slot });
                    setBusy(false);
                    if (r.ok) {
                      setMode("none");
                      router.refresh();
                    } else setMsg(r.message);
                  }}
                >
                  {busy ? "Saving…" : `Move to ${slot ? formatDateLong(Date.parse(slot), timezone) : "…"}`}
                </Button>
              </div>
            )}

            {mode === "cancel" && preview && (
              <div className="mt-5 flex flex-col gap-4">
                <p className="rounded-xl bg-ink-800 p-4 text-sm">
                  {preview.late
                    ? `You're cancelling within ${preview.windowHours} hours of your appointment. ${preview.feeCents > 0 ? `${formatMoney(preview.feeCents)} of your deposit is kept as a late-cancellation fee.` : ""} ${preview.refundCents > 0 ? `${formatMoney(preview.refundCents)} will be refunded.` : "No refund is due."}`
                    : preview.depositPaidCents > 0
                      ? `Your full deposit of ${formatMoney(preview.refundCents)} will be refunded to your card.`
                      : "There's no charge for cancelling."}
                </p>
                <label htmlFor="cancel-reason" className="text-sm font-semibold">
                  Reason <span className="font-normal text-fg-subtle">(optional)</span>
                </label>
                <Textarea id="cancel-reason" className="min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const r = await cancelAction({ token, reason: reason || undefined });
                      setBusy(false);
                      if (r.ok) {
                        setMode("none");
                        router.refresh();
                      } else setMsg(r.message);
                    }}
                  >
                    {busy ? "Cancelling…" : "Yes, cancel my booking"}
                  </Button>
                  <Dialog.Close className={buttonVariants({ variant: "secondary" })}>Keep my booking</Dialog.Close>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
