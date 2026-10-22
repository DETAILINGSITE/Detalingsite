import type { Catalog, CatalogService } from "@/lib/domain/catalog";
import type { PricingContext } from "@/lib/domain/pricing";

const svc = (id: string, p: Partial<CatalogService> = {}): CatalogService => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  kind: "service",
  categoryId: null,
  basePriceCents: 10000,
  baseDurationMin: 60,
  quoteOnly: false,
  locationTypes: ["mobile", "shop"],
  active: true,
  sizeOverrides: {},
  ...p,
});

export const catalog: Catalog = {
  sizes: [
    { id: "sedan", label: "Sedan", priceMultiplier: 1, durationMultiplier: 1, sort: 1 },
    { id: "suv", label: "SUV", priceMultiplier: 1.2, durationMultiplier: 1.15, sort: 2 },
    { id: "truck", label: "Truck", priceMultiplier: 1.3, durationMultiplier: 1.25, sort: 3 },
    { id: "van", label: "Van", priceMultiplier: 1.35, durationMultiplier: 1.3, sort: 4 },
  ],
  services: [
    svc("wash", { basePriceCents: 8900, baseDurationMin: 90 }),
    svc("interior", { basePriceCents: 14900, baseDurationMin: 150 }),
    svc("decon", { kind: "addon", basePriceCents: 6900, baseDurationMin: 45 }),
    svc("ceramic", { basePriceCents: 59900, baseDurationMin: 300, locationTypes: ["shop"] }),
    svc("headlight", { kind: "addon", basePriceCents: 7900, baseDurationMin: 60 }),
    svc("engine", { kind: "addon", basePriceCents: 5900, baseDurationMin: 45 }),
    svc("ppf", { quoteOnly: true, basePriceCents: 0, baseDurationMin: 480, locationTypes: ["shop"] }),
    svc("pc1", { basePriceCents: 39900, baseDurationMin: 300 }),
    svc("pc2", { basePriceCents: 69900, baseDurationMin: 480, sizeOverrides: { truck: { durationMin: 600, priceCents: 99900 } } }),
    svc("retired", { active: false }),
  ],
  packages: [
    { id: "premium", slug: "premium", name: "Premium", tier: 2, basePriceCents: 27900, baseDurationMin: 270, serviceIds: ["wash", "interior", "decon"], active: true, sizeOverrides: { van: { priceCents: 39900 } } },
  ],
  rules: [
    { kind: "requires", serviceId: "ceramic", targetServiceId: "decon", reason: "Coatings need decontaminated paint." },
    { kind: "requires", serviceId: "pc1", targetServiceId: "decon", reason: "Polishing needs clean paint." },
    { kind: "excludes", serviceId: "pc1", targetServiceId: "pc2", reason: "Choose one level." },
  ],
  conditions: [
    { id: "light", group: "soil", label: "Light", surchargeType: "flat", surchargeValue: 0, extraMinutes: 0 },
    { id: "moderate", group: "soil", label: "Moderate", surchargeType: "flat", surchargeValue: 2500, extraMinutes: 30 },
    { id: "heavy", group: "soil", label: "Heavy", surchargeType: "percent", surchargeValue: 20, extraMinutes: 60 },
    { id: "pet_hair", group: "extra", label: "Pet hair", surchargeType: "flat", surchargeValue: 3000, extraMinutes: 30 },
  ],
};

export const ctx = (p: Partial<PricingContext> = {}): PricingContext => ({
  catalog,
  deposit: { mode: "fixed", valueCents: 5000 },
  taxRateBps: 0,
  taxTravel: false,
  priceRoundingCents: 100,
  travelFeeCents: 0,
  promo: null,
  quote: null,
  maxJobMinutes: 600,
  ...p,
});

export const sel = (p: Partial<{ sizeId: string; packageId: string | null; serviceIds: string[]; addonIds: string[]; conditionIds: string[]; locationType: "mobile" | "shop" | null }> = {}) => ({
  sizeId: "sedan",
  packageId: null,
  serviceIds: [] as string[],
  addonIds: [] as string[],
  conditionIds: [] as string[],
  ...p,
});
