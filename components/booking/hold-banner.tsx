"use client";
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { extendHoldAction } from "@/app/(flow)/book/actions";
import { Button } from "@/components/ui/button";
import { toLocalClock } from "@/lib/booking/wizard-state";

/** Countdown for the slot hold. Announces only at 2 and 1 minutes (not every second). */
export function HoldBanner({ token, expiresAt, canExtend, onExtended, onExpired }: { token: string; expiresAt: string; canExtend: boolean; onExtended: (iso: string) => void; onExpired: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Date.parse(expiresAt) - now);
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  // Text changes only when crossing the 2- and 1-minute marks, so the live region speaks twice.
  const announce = remaining === 0 ? "" : remaining <= 60_000 ? "One minute left to finish your booking." : remaining <= 120_000 ? "Two minutes left to finish your booking." : "";

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (remaining === 0) onExpired();
  }, [remaining, onExpired]);

  const low = remaining < 2 * 60_000;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm ${low ? "border-warning/50 bg-warning/10" : "border-white/10 bg-ink-850"}`}>
      <p className="flex items-center gap-2">
        <Timer className="size-5 text-gold-300" aria-hidden="true" />
        We're holding your time for <span className="tabular font-semibold">{mins}:{String(secs).padStart(2, "0")}</span>
      </p>
      {canExtend && low && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            const r = await extendHoldAction({ token });
            if (r.ok && "holdExpiresAt" in r) onExtended(toLocalClock(r.holdExpiresAt, r.serverNow));
          }}
        >
          Need more time?
        </Button>
      )}
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  );
}
