import { business } from "@/config/business";
import { EmailText } from "@/components/ui/email";
import { isPlaceholder } from "@/config/placeholder";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Privacy Policy", description: `How ${business.name} collects, uses and protects your information.`, path: "/privacy" });

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 22, 2026">
      <p>This policy explains what personal information {business.legalName} (“we”) collects when you use this website or book a service, and how we use it.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Contact details you give us: name, email, phone number and service address.</li>
        <li>Booking details: vehicle, services, appointment time, notes and photos you upload for a quote.</li>
        <li>Payment confirmations from our payment processor. We never see or store your full card number.</li>
        <li>Anonymous usage statistics (cookieless analytics) and, only if you opt in, advertising cookies.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To schedule, perform and confirm your appointment, and send reminders.</li>
        <li>To reply to your messages and quote requests.</li>
        <li>If you started a booking and agreed to be contacted, to follow up about that booking.</li>
        <li>Text messages are sent only if you opt in. Reply STOP to opt out at any time.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>Only service providers that help us run the business: payment processing (Stripe), email (Resend), text messages (Twilio), bot protection (Cloudflare), address lookup (Google), file storage (Cloudflare R2) and hosting. We do not sell your personal information.</p>
      <h2>How long we keep it</h2>
      <p>Booking records are kept as long as needed for accounting and warranty purposes. Unconverted enquiries are deleted after 12 months.</p>
      <h2>Your choices</h2>
      <p>You can ask us to access, correct or delete your information by {isPlaceholder("contact.email") ? `calling ${business.contact.phoneDisplay}` : <>emailing <EmailText email={business.contact.email} fallback="us" /></>}.</p>
      <h2>Contact</h2>
      <p>{business.legalName}{isPlaceholder("contact.email") ? "" : <> · <EmailText email={business.contact.email} fallback="email via the contact page" /></>} · {business.contact.phoneDisplay}</p>
    </LegalPage>
  );
}
