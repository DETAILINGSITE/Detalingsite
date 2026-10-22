"use client";
/**
 * Exit-intent offer (flag: business.flags.exitIntentOffer, off by default).
 * Desktop with a fine pointer only — never on touch/mobile — and at most once per 30 days.
 */
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { business } from "@/config/business";
import { Button } from "@/components/ui/button";

const KEY = "exit-offer.seen";

export function ExitIntentOffer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine) and (min-width: 1024px)").matches) return;
    try {
      const seen = Number(localStorage.getItem(KEY) ?? 0);
      if (Date.now() - seen < 30 * 86_400_000) return;
    } catch {}
    const onLeave = (e: MouseEvent) => {
      if (e.clientY > 0 || e.relatedTarget) return;
      setOpen(true);
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {}
      document.removeEventListener("mouseout", onLeave);
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[101] w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-ink-800 p-6">
          <Dialog.Title className="text-xl font-bold">{business.exitOffer.headline}</Dialog.Title>
          <Dialog.Description className="mt-2 text-fg-muted">
            Use code <strong className="text-gold-300">{business.exitOffer.promoCode}</strong> when you book.
          </Dialog.Description>
          <div className="mt-5 flex gap-2">
            <Button asChild>
              <a href="/book">Book now</a>
            </Button>
            <Dialog.Close asChild>
              <Button variant="secondary">No thanks</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
