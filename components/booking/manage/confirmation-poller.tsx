"use client";
/** While the payment webhook is in flight, poll and refresh when the booking confirms (≤ 60s). */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { bookingStatusAction } from "@/app/(flow)/booking/[token]/actions";

export function ConfirmationPoller({ token }: { token: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    let tries = 0;
    const t = window.setInterval(async () => {
      tries++;
      const s = await bookingStatusAction({ token });
      if (s?.status === "confirmed") {
        window.clearInterval(t);
        router.refresh();
      } else if (tries >= 30) {
        window.clearInterval(t);
        setTimedOut(true);
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [token, router]);
  return (
    <div role="status" aria-live="polite" className="card flex flex-col gap-2 p-6">
      {timedOut ? (
        <>
          <p className="font-semibold">Payment received — your confirmation is on its way.</p>
          <p className="text-sm text-fg-muted">It's taking a little longer than usual. You'll get an email as soon as it's confirmed; no need to pay again.</p>
        </>
      ) : (
        <>
          <p className="flex items-center gap-3 font-semibold">
            <span className="size-4 animate-spin rounded-full border-2 border-gold-300 border-t-transparent" aria-hidden="true" />
            Confirming your payment…
          </p>
          <p className="text-sm text-fg-muted">This usually takes a few seconds. Please don't close this page.</p>
        </>
      )}
    </div>
  );
}
