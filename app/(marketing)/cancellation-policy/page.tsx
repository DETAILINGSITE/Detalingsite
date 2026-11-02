import { business } from "@/config/business";
import { LegalPage } from "@/components/marketing/legal-page";
import { formatMoney } from "@/lib/domain/money";
import { getPublicCatalog } from "@/lib/server/data/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Cancellation Policy", description: "How rescheduling, cancellations and refunds work.", path: "/cancellation-policy" });

/** Generated from the live settings so the policy shown always matches what the system enforces. */
export default async function CancellationPolicyPage() {
  const { cancellation, reschedule, deposit } = await getPublicCatalog();
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
          : `A deposit of ${deposit.mode === "fixed" ? formatMoney(deposit.valueCents) : `${deposit.percent}% of the total`} holds your appointment and is applied to your total.`}
      </p>
      <h2>Cancelling</h2>
      <ul>
        {deposit.mode === "none" ? (
          <li>Please cancel or reschedule at least <strong>{cancellation.windowHours} hours</strong> before your appointment so we can offer the time to someone else.</li>
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
