import type { Catalog } from "@/lib/domain/catalog";
import type { DepositPolicy } from "@/lib/domain/settings";

/** Everything the client wizard needs, serialised from the server page. */
export interface WizardData {
  catalog: Catalog;
  sizes: { id: string; label: string; description: string }[];
  conditions: { id: string; group: "soil" | "extra"; label: string; description: string }[];
  services: {
    id: string;
    slug: string;
    name: string;
    summary: string;
    kind: "service" | "addon";
    quoteOnly: boolean;
    locationTypes: ("mobile" | "shop")[];
    categoryName: string | null;
  }[];
  packages: { id: string; slug: string; name: string; tagline: string; featured: boolean; serviceIds: string[] }[];
  pricing: { deposit: DepositPolicy; taxRateBps: number; taxTravel: boolean; priceRoundingCents: number; maxJobMinutes: number };
  zones: { id: string; name: string; zipCodes: string[]; travelFeeCents: number }[];
  serviceMode: "mobile" | "shop" | "both";
  timezone: string;
  shop: { enabled: boolean; label: string; mapsUrl: string };
  cancellationWindowHours: number;
  payments: { mode: "stripe" | "fake" | "none"; publishableKey: string | null };
  smsAvailable: boolean;
  uploadsAvailable: boolean;
  placesAvailable: boolean;
  smsConsentText: string;
  businessName: string;
  phoneDisplay: string;
  phone: string;
}

export interface WizardInit {
  path: "service" | "custom" | null;
  quoteToken: string | null;
  sizeId?: string;
  packageId?: string | null;
  serviceIds?: string[];
  zip?: string;
  locationType?: "mobile" | "shop" | null;
  /** Server-loaded quote details when arriving from /quote/[token]. */
  quote?: {
    number: string;
    priceCents: number;
    durationMin: number;
    sizeId: string | null;
    locationType: "mobile" | "shop";
    zip: string | null;
    addressLabel: string;
    customer: { name: string; email: string; phone: string };
  } | null;
  quoteError?: string | null;
}
