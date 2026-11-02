import { business } from "@/config/business";
import { isPlaceholder } from "@/config/placeholder";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Accessibility", description: "Our commitment to an accessible website.", path: "/accessibility" });

export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility Statement" updated="October 22, 2026">
      <p>We want everyone to be able to book with us. This website aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p>
      <h2>What we do</h2>
      <ul>
        <li>The whole booking flow works with a keyboard and screen readers.</li>
        <li>Text meets AA colour contrast, and controls are at least 44 pixels in size.</li>
        <li>Animations are reduced when your device asks for reduced motion.</li>
        <li>Every page is tested automatically for accessibility issues.</li>
      </ul>
      <h2>Need help?</h2>
      <p>
        If anything on this site doesn't work for you, call {business.contact.phoneDisplay}{isPlaceholder("contact.email") ? "" : ` or email ${business.contact.email}`} and we'll book you in directly — and fix the problem.
      </p>
    </LegalPage>
  );
}
