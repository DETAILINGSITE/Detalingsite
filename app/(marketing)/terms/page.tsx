import Link from "next/link";
import { business } from "@/config/business";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Terms of Service", description: `Terms for booking services with ${business.name}.`, path: "/terms" });

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 22, 2026">
      <p>By booking a service with {business.legalName} you agree to these terms.</p>
      <h2>Bookings and deposits</h2>
      <p>A booking is confirmed once any required deposit is paid. The deposit is applied to your total; the balance is due when the work is complete.</p>
      <h2>Pricing</h2>
      <p>Prices depend on vehicle size and condition. If the vehicle's condition differs significantly from what was described, we'll discuss any change before starting work.</p>
      <h2>Access and preparation</h2>
      <p>For mobile service, please provide safe access to the vehicle and remove personal items. We're not responsible for items left in the vehicle.</p>
      <h2>Changes and cancellations</h2>
      <p>See our <Link href="/cancellation-policy" className="text-gold-300 underline">cancellation policy</Link>.</p>
      <h2>Satisfaction</h2>
      <p>{business.proof.guarantee}</p>
      <h2>Limitation of liability</h2>
      <p>We take great care with every vehicle. Pre-existing damage (chips, failing clear coat, loose trim) may be noted before work begins.</p>
    </LegalPage>
  );
}
