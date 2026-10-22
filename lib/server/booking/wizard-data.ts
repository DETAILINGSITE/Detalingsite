import { business } from "@/config/business";
import type { WizardData } from "@/lib/booking/wizard-types";
import { env, paymentsMode, smsConfigured, storageMode } from "@/lib/env";
import { getPublicCatalog, getPublicSchedule } from "../data/public";
import { placesEnabled } from "../places";

/** Serializable data for the client wizard, built from the cached public catalog. */
export async function loadWizardData(): Promise<WizardData> {
  const [catalog, schedule] = await Promise.all([getPublicCatalog(), getPublicSchedule()]);
  const categoryName = new Map(catalog.categories.map((c) => [c.id, c.name]));
  const a = business.shop.address;
  const e = env();
  const maxJobMinutes = Math.max(0, ...schedule.hours.map((h) => {
    const [oh, om] = h.opens.split(":").map(Number);
    const [ch, cm] = h.closes.split(":").map(Number);
    return (ch ?? 0) * 60 + (cm ?? 0) - ((oh ?? 0) * 60 + (om ?? 0));
  }));
  const stripPrices = <T extends { fromCents?: number; bySize?: unknown }>(x: T) => {
    const { fromCents: _f, bySize: _b, ...rest } = x;
    return rest;
  };
  return {
    catalog: {
      sizes: catalog.sizes,
      services: catalog.services.map(stripPrices),
      packages: catalog.packages.map(({ includedNames: _i, ...p }) => stripPrices(p)),
      rules: catalog.rules,
      conditions: catalog.conditions,
    },
    sizes: catalog.sizes.map((z) => ({ id: z.id, label: z.label, description: "" })),
    conditions: catalog.conditions.map((c) => ({ id: c.id, group: c.group, label: c.label, description: c.description })),
    services: catalog.services.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      summary: s.summary,
      kind: s.kind,
      quoteOnly: s.quoteOnly,
      locationTypes: s.locationTypes,
      categoryName: s.categoryId ? (categoryName.get(s.categoryId) ?? null) : null,
    })),
    packages: catalog.packages.map((p) => ({ id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, featured: p.featured, serviceIds: p.serviceIds })),
    pricing: {
      deposit: catalog.deposit,
      taxRateBps: catalog.taxRateBps,
      taxTravel: catalog.taxTravel,
      priceRoundingCents: catalog.priceRoundingCents,
      maxJobMinutes,
    },
    zones: schedule.zones.map((z) => ({ id: z.id, name: z.name, zipCodes: z.zipCodes, travelFeeCents: z.travelFeeCents })),
    serviceMode: schedule.serviceMode,
    timezone: schedule.timezone,
    shop: { enabled: business.shop.enabled && schedule.serviceMode !== "mobile", label: `${a.line1}, ${a.city}, ${a.region} ${a.postalCode}`, mapsUrl: business.shop.mapsUrl },
    cancellationWindowHours: catalog.cancellation.windowHours,
    payments: { mode: paymentsMode(e), publishableKey: e.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null },
    smsAvailable: smsConfigured(e),
    uploadsAvailable: storageMode(e) !== "none",
    placesAvailable: placesEnabled(),
    smsConsentText: business.smsConsent.text,
    businessName: business.name,
    phoneDisplay: business.contact.phoneDisplay,
    phone: business.contact.phone,
  };
}
