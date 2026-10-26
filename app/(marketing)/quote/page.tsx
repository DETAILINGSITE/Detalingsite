import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/wizard";
import { loadWizardData } from "@/lib/server/booking/wizard-data";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Get a Custom Quote",
  description: "Anything unusual or outside our packages — describe the job, add photos and we'll send you a price.",
  path: "/quote",
});

/** Standalone custom-job request: the same wizard, starting on the quote path. */
export default async function QuotePage() {
  const data = await loadWizardData();
  // The wizard reads ?step= on the client; the static shell shows a placeholder until then.
  return (
    <Suspense fallback={<div className="container-site min-h-[60dvh] py-16" aria-busy="true" />}>
      <BookingWizard data={data} init={{ path: "custom", quoteToken: null }} />
    </Suspense>
  );
}
