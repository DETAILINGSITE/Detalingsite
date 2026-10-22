/** Catalog shapes used by the pricing engine. Decoupled from DB rows on purpose. */

export type LocationType = "mobile" | "shop";

export interface SizeOverride {
  priceCents?: number | null;
  durationMin?: number | null;
}

export interface VehicleSize {
  id: string;
  label: string;
  /** e.g. 1.25 — stored as numeric(4,2) */
  priceMultiplier: number;
  durationMultiplier: number;
  sort: number;
}

export interface CatalogService {
  id: string;
  slug: string;
  name: string;
  kind: "service" | "addon";
  categoryId: string | null;
  basePriceCents: number;
  baseDurationMin: number;
  quoteOnly: boolean;
  locationTypes: LocationType[];
  active: boolean;
  sizeOverrides: Record<string, SizeOverride>;
}

export interface CatalogPackage {
  id: string;
  slug: string;
  name: string;
  tier: number;
  basePriceCents: number;
  baseDurationMin: number;
  serviceIds: string[];
  active: boolean;
  sizeOverrides: Record<string, SizeOverride>;
}

export interface ServiceRule {
  id?: string;
  kind: "requires" | "excludes";
  serviceId: string;
  targetServiceId: string;
  reason: string;
}

export interface Condition {
  id: string;
  group: "soil" | "extra";
  label: string;
  surchargeType: "flat" | "percent";
  surchargeValue: number;
  extraMinutes: number;
}

export interface Catalog {
  sizes: VehicleSize[];
  services: CatalogService[];
  packages: CatalogPackage[];
  rules: ServiceRule[];
  conditions: Condition[];
}

export interface Promo {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
}

export function indexCatalog(catalog: Catalog) {
  return {
    sizes: new Map(catalog.sizes.map((s) => [s.id, s])),
    services: new Map(catalog.services.map((s) => [s.id, s])),
    servicesBySlug: new Map(catalog.services.map((s) => [s.slug, s])),
    packages: new Map(catalog.packages.map((p) => [p.id, p])),
    packagesBySlug: new Map(catalog.packages.map((p) => [p.slug, p])),
    conditions: new Map(catalog.conditions.map((c) => [c.id, c])),
  };
}
