"use client";
import Link from "next/link";
import { useState } from "react";
import { previewPromoAction, startPaymentAction } from "@/app/(flow)/book/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { track } from "@/lib/analytics/track";
import type { PriceSummary } from "@/lib/booking/summary";
import { formatMoney } from "@/lib/domain/money";
import { PaymentPanel } from "../payment-panel";
import { StepShell } from "../step-shell";
import { SummaryBody } from "../summary";
import type { StepProps } from "./types";

export function ReviewStep({ state, dispatch, data, onBack, onConfirmed, summaryProps }: StepProps & { onConfirmed: (token: string) => void; summaryProps: { when: string | null; where: string | null; vehicle: string | null } }) {
  const hold = state.hold;
  const [price, setPrice] = useState<PriceSummary | null>(hold?.price ?? null);
  const [promo, setPromo] = useState(state.review.promoCode);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [agree, setAgree] = useState(state.review.agreePolicy);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [payment, setPayment] = useState<{ driver: "stripe" | "fake"; clientSecret: string; sessionId: string; amountCents: number } | null>(null);

  if (!hold) return null;

  const applyPromo = async () => {
    setPromoMsg(null);
    const res = await previewPromoAction({ token: hold.token, promoCode: promo });
    if (res.ok && "price" in res) {
      setPrice(res.price);
      dispatch({ type: "review", patch: { promoCode: promo } });
      setPromoMsg(`Code applied — you save ${formatMoney(res.price.discountCents)}.`);
    } else setPromoMsg(res.message ?? "That code isn't valid.");
  };

  const proceed = async () => {
    if (!agree) {
      setError("Please agree to the cancellation policy to continue.");
      document.getElementById("agree-policy")?.focus();
      return;
    }
    setError(null);
    setPending(true);
    dispatch({ type: "review", patch: { agreePolicy: true } });
    const res = await startPaymentAction({
      token: hold.token,
      sessionId: state.ids.sessionId,
      agreePolicy: true,
      promoCode: state.review.promoCode || undefined,
      expectedTotalCents: price?.totalCents ?? hold.price.totalCents,
    });
    setPending(false);
    if (!res.ok) {
      if (res.code === "PRICE_CHANGED" && "totalCents" in res) {
        setError(`${res.message} New total: ${formatMoney(res.totalCents)}.`);
        setPrice((p) => (p ? { ...p, totalCents: res.totalCents, depositCents: res.depositCents, balanceCents: res.totalCents - res.depositCents } : p));
      } else setError(res.message);
      return;
    }
    if (res.kind === "confirmed") {
      track("Booking Confirmed", { deposit: false });
      onConfirmed(res.token);
      return;
    }
    track("Payment Started");
    setPayment({ driver: res.driver, clientSecret: res.clientSecret, sessionId: res.sessionId, amountCents: res.amountCents });
  };

  const needsPayment = (price?.depositCents ?? 0) > 0 && data.payments.mode !== "none";

  return (
    <StepShell title="Review and confirm" onBack={payment ? undefined : onBack} error={error} hideNext={!!payment} pending={pending} onNext={() => void proceed()} nextLabel={needsPayment ? "Continue to payment" : "Confirm booking"}>
      <div className="card p-5 lg:hidden">
        <SummaryBody price={price} timezone={data.timezone} {...summaryProps} />
      </div>
      <div className="hidden text-fg-muted lg:block">Check your details in the summary. You can go back to change anything.</div>

      {!payment && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="promo" className="text-sm font-semibold">
              Promo code <span className="font-normal text-fg-subtle">(optional)</span>
            </label>
            <div className="flex gap-2">
              <Input id="promo" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} className="max-w-xs" autoComplete="off" />
              <Button type="button" variant="secondary" disabled={!promo} onClick={() => void applyPromo()}>
                Apply
              </Button>
            </div>
            {promoMsg && <p role="status" className="text-sm text-fg-muted">{promoMsg}</p>}
          </div>
          <Checkbox
            id="agree-policy"
            checked={agree}
            onCheckedChange={setAgree}
            invalid={!!error && !agree}
            label={<>I agree to the <Link href="/cancellation-policy" target="_blank" className="text-gold-300 underline">cancellation policy</Link></>}
            description={`Free changes up to ${data.cancellationWindowHours} hours before your appointment.`}
          />
          {needsPayment ? (
            <p className="text-sm text-fg-muted">
              A {formatMoney(price?.depositCents ?? 0)} deposit holds your time. The balance of {formatMoney(price?.balanceCents ?? 0)} is due when we're done.
            </p>
          ) : (
            <p className="text-sm text-fg-muted">No payment needed now — you'll pay {formatMoney(price?.totalCents ?? 0)} at the appointment.</p>
          )}
        </>
      )}

      {payment && (
        <section aria-label="Payment" className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Pay your deposit</h2>
          <PaymentPanel
            driver={payment.driver}
            clientSecret={payment.clientSecret}
            sessionId={payment.sessionId}
            amountCents={payment.amountCents}
            publishableKey={data.payments.publishableKey}
            onPaid={() => {
              track("Deposit Paid");
              onConfirmed(hold.token);
            }}
          />
        </section>
      )}
    </StepShell>
  );
}
