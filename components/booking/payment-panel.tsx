"use client";
/**
 * Deposit payment. Stripe: Checkout Sessions (ui_mode "elements") + Payment Element.
 * Fake (tests/dev): a clearly-labelled panel that triggers the real webhook path.
 * The booking is confirmed by the webhook, never by this component.
 */
import { CheckoutElementsProvider, PaymentElement, useCheckout } from "@stripe/react-stripe-js/checkout";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/domain/money";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(key: string) {
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

function StripeForm({ amountCents, onPaid }: { amountCents: number; onPaid: () => void }) {
  const result = useCheckout();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (result.type === "loading") return <p role="status" className="text-fg-muted">Loading secure payment…</p>;
  if (result.type === "error") return <p role="alert" className="text-danger">{result.error.message}</p>;
  const checkout = result.checkout;
  return (
    <div className="flex flex-col gap-5">
      <PaymentElement options={{ layout: "accordion" }} />
      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Button
        type="button"
        size="lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await checkout.confirm({ redirect: "if_required" });
          setBusy(false);
          if (res.type === "error") setError(res.error.message);
          else onPaid();
        }}
      >
        <Lock aria-hidden="true" /> {busy ? "Processing…" : `Pay ${formatMoney(amountCents)} deposit`}
      </Button>
    </div>
  );
}

function FakePanel({ sessionId, amountCents, onPaid }: { sessionId: string; amountCents: number; onPaid: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [stage, setStage] = useState<"form" | "3ds">("form");
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    const res = await fetch("/api/test/fake-pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, outcome: "success" }) });
    setBusy(false);
    if (res.ok) onPaid();
    else setMsg("Test payment endpoint failed.");
  };
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-warning/50 bg-warning/5 p-5" data-testid="fake-payment">
      <p className="text-sm font-semibold text-warning">TEST MODE — no real payment is taken</p>
      {stage === "3ds" ? (
        <>
          <p className="text-sm">Simulated 3-D Secure challenge.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void pay()} disabled={busy}>Complete authentication</Button>
            <Button type="button" variant="secondary" onClick={() => { setStage("form"); setMsg("Authentication failed. Try again or use another card."); }}>Fail authentication</Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void pay()} disabled={busy}>Pay {formatMoney(amountCents)} (succeeds)</Button>
          <Button type="button" variant="secondary" onClick={() => setMsg("Your card was declined. Try another card.")}>Card declined</Button>
          <Button type="button" variant="secondary" onClick={() => setStage("3ds")}>Requires 3-D Secure</Button>
        </div>
      )}
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
    </div>
  );
}

export function PaymentPanel({
  driver,
  clientSecret,
  sessionId,
  amountCents,
  publishableKey,
  onPaid,
}: {
  driver: "stripe" | "fake";
  clientSecret: string;
  sessionId: string;
  amountCents: number;
  publishableKey: string | null;
  onPaid: () => void;
}) {
  const stripe = useMemo(() => (driver === "stripe" && publishableKey ? getStripe(publishableKey) : null), [driver, publishableKey]);
  if (driver === "fake") return <FakePanel sessionId={sessionId} amountCents={amountCents} onPaid={onPaid} />;
  if (!stripe) return <p role="alert" className="text-danger">Payments are not configured.</p>;
  return (
    <CheckoutElementsProvider
      stripe={stripe}
      options={{
        clientSecret,
        elementsOptions: {
          appearance: {
            theme: "night",
            variables: { colorPrimary: "#c8a24a", colorBackground: "#101215", borderRadius: "12px", fontSizeBase: "16px" },
          },
        },
      }}
    >
      <StripeForm amountCents={amountCents} onPaid={onPaid} />
    </CheckoutElementsProvider>
  );
}
