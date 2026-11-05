import { business } from "@/config/business";
import { LegalPage } from "@/components/marketing/legal-page";
import { formatMoney } from "@/lib/domain/money";
import { paymentsMode } from "@/lib/env";
import { getPublicCatalog } from "@/lib/server/data/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Cancellation Policy", description: "How rescheduling, cancellations and refunds work.", path: "/cancellation-policy" });

/** Generated from the live settings so the policy shown always matches what the system enforces. */
export default async function CancellationPolicyPage() {
  const catalog = await getPublicCatalog();
  const { cancellation, reschedule } = catalog;
  // Same rule as checkout: no payment provider means no deposit is taken, so don't promise one.
  const deposit = paymentsMode() === "none" ? ({ mode: "none" } as const) : catalog.deposit;
  const depositText = deposit.mode === "fixed" ? formatMoney(deposit.valueCents) : deposit.mode === "percent" ? `${deposit.percent}% of the total` : "";
  const fee = cancellation.lateFee;
  const feeText =
    fee.type === "forfeit_deposit"
      ? "the deposit is non-refundable"
      : fee.type === "fixed"
        ? `a ${formatMoney(fee.cents)} late-cancellation fee applies (taken from the deposit)`
        : `a late-cancellation fee of ${fee.percent}% of the booking total applies (taken from the deposit)`;
  return (
    <LegalPage title="Cancellation Policy" updated="October 22, 2026">
      <h2>Deposits</h2>
      <p>
        {deposit.mode === "none"
          ? "We don't currently take a deposit; payment is due when the work is complete."
          : cancellation.depositRefundable
            ? `A deposit of ${depositText} holds your appointment and is applied to your total.`
            : `A non-refundable deposit of ${depositText} holds your appointment. It is applied to your total, so you pay the rest at your appointment.`}
      </p>
      <h2>Cancelling</h2>
      <ul>
        {deposit.mode === "none" ? (
          <li>Please cancel or reschedule at least <strong>{cancellation.windowHours} hours</strong> before your appointment so we can offer the time to someone else.</li>
        ) : !cancellation.depositRefundable ? (
          <>
            <li>The deposit is <strong>non-refundable</strong>: if you cancel, at any time, the deposit is kept.</li>
            <li>Need a different time? Reschedule instead, at least <strong>{reschedule.minHoursBefore} hours</strong> before your appointment, and your deposit moves with the booking.</li>
            <li>Missed appointments (no-shows) forfeit the deposit.</li>
          </>
        ) : (
          <>
            <li>Cancel <strong>{cancellation.windowHours} hours or more</strong> before your appointment: full refund of your deposit.</li>
            <li>Cancel <strong>less than {cancellation.windowHours} hours</strong> before your appointment: {feeText}.</li>
            <li>Missed appointments (no-shows) forfeit the deposit.</li>
          </>
        )}
      </ul>
      <h2>Rescheduling</h2>
      <p>
        You can reschedule online up to {reschedule.minHoursBefore} hours before your appointment, up to {reschedule.maxCount} times. After that, please call{" "}
        {business.contact.phoneDisplay}.
      </p>
      <h2>Weather</h2>
      <p>If rain prevents exterior work, we'll contact you to move your appointment at no charge.</p>
      <h2>Refunds</h2>
      <p>Refunds go back to the original card and usually appear within 5–10 business days.</p>
    </LegalPage>
  );
}
