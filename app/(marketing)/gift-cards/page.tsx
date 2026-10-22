import { notFound } from "next/navigation";
import { business } from "@/config/business";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageTransition } from "@/components/motion/page-transition";
import { buttonVariants } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Gift Cards",
  description: `Give the gift of a showroom finish — ${business.name} gift cards.`,
  path: "/gift-cards",
});

/** Flag: business.flags.giftCards. v1 = Stripe Payment Link; redemption is applied in admin. */
export default function GiftCardsPage() {
  if (!business.flags.giftCards) notFound();
  return (
    <PageTransition>
      <div className="container-site flex flex-col gap-8 py-16 md:py-24">
        <SectionHeading as="h1" eyebrow="Gift cards" title="Give a showroom finish." intro="Perfect for birthdays, new car owners and anyone who never has time to clean theirs. Delivered by email instantly." />
        {business.giftCards.paymentLink ? (
          <a href={business.giftCards.paymentLink} className={buttonVariants({ size: "lg" }) + " w-fit"} rel="noopener">
            Buy a gift card
          </a>
        ) : (
          <p className="text-fg-muted">Gift cards are coming soon — call us to arrange one today.</p>
        )}
        <p className="text-sm text-fg-subtle">Gift cards are redeemed when booking; mention the code in your booking notes or call us.</p>
      </div>
    </PageTransition>
  );
}
