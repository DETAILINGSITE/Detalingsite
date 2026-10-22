import { BookingWizard } from "@/components/booking/wizard";
import { loadWizardData } from "@/lib/server/booking/wizard-data";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({
  title: "Get a Custom Quote",
  description: "PPF, boats, RVs, fleets or anything unusual — describe the job, add photos and we'll send you a price.",
  path: "/quote",
});

/** Standalone custom-job request: the same wizard, starting on the quote path. */
export default async function QuotePage() {
  const data = await loadWizardData();
  return <BookingWizard data={data} init={{ path: "custom", quoteToken: null }} />;
}
