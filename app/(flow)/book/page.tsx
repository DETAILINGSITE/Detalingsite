import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { BookingWizard } from "@/components/booking/wizard";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import type { WizardInit } from "@/lib/booking/wizard-types";
import { now } from "@/lib/server/clock";
import { formatAddress } from "@/lib/server/booking/location";
import { loadBookableQuote } from "@/lib/server/booking/quotes-lookup";
import { loadWizardData } from "@/lib/server/booking/wizard-data";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Book Online",
  description: "Choose your service, vehicle, location and time — book your detail online in minutes.",
  path: "/book",
  noindex: true,
});

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BookPage({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const sp = await searchParams;
  const data = await loadWizardData();
  const quoteToken = one(sp.quote) ?? null;

  const init: WizardInit = {
    path: one(sp.path) === "custom" ? "custom" : null,
    quoteToken: null,
    sizeId: one(sp.size),
    packageId: one(sp.pkg) ?? null,
    serviceIds: one(sp.svc)?.split(",").filter(Boolean),
    zip: one(sp.zip)?.replace(/\D/g, "").slice(0, 5),
    locationType: one(sp.loc) === "shop" ? "shop" : one(sp.loc) === "mobile" ? "mobile" : null,
  };

  if (quoteToken) {
    const db = getDb();
    const q = await loadBookableQuote(db, quoteToken, new Date(now()));
    if (q.ok) {
      const [c] = await db.select().from(s.customers).where(eq(s.customers.id, q.quote.customerId));
      init.quoteToken = quoteToken;
      init.quote = {
        number: q.quote.number,
        priceCents: q.quote.quotedPriceCents ?? 0,
        durationMin: q.quote.quotedDurationMin ?? 60,
        sizeId: q.quote.vehicleSizeId,
        locationType: q.quote.locationType,
        zip: q.quote.address?.postalCode ?? null,
        addressLabel: q.quote.locationType === "shop" ? data.shop.label : formatAddress(q.quote.address),
        customer: { name: c?.name ?? "", email: c?.email ?? "", phone: c?.phoneE164 ?? "" },
      };
    } else {
      init.quoteError =
        q.reason === "expired"
          ? "That quote has expired — request a new one or call us."
          : q.reason === "accepted"
            ? "That quote has already been booked. Check your email for the booking link."
            : "That quote link isn't valid.";
    }
  }

  return <BookingWizard data={data} init={init} />;
}
