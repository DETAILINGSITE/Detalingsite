import { asc } from "drizzle-orm";
import type { Queryable } from "@/db/client";
import * as s from "@/db/schema";
import type {
  Catalog,
  CatalogPackage,
  CatalogService,
  Condition,
  SizeOverride,
  VehicleSize,
} from "@/lib/domain/catalog";

export interface ServiceView extends CatalogService {
  summary: string;
  descriptionMd: string;
  includes: string[];
  whatToExpect: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  isPlaceholder: boolean;
  sort: number;
  categorySlug: string | null;
}

export interface PackageView extends CatalogPackage {
  tagline: string;
  featured: boolean;
  isPlaceholder: boolean;
  sort: number;
}

export interface ConditionView extends Condition {
  description: string;
  sort: number;
}

export interface CategoryView {
  id: string;
  slug: string;
  name: string;
  description: string;
  sort: number;
}

export interface CatalogView {
  sizes: VehicleSize[];
  categories: CategoryView[];
  services: ServiceView[];
  packages: PackageView[];
  rules: Catalog["rules"];
  conditions: ConditionView[];
}

/** Loads the whole catalog (small: tens of rows). `activeOnly` filters for public pages. */
export async function loadCatalog(db: Queryable, opts: { activeOnly?: boolean } = {}): Promise<CatalogView> {
  const [sizes, categories, services, serviceOverrides, packages, items, packageOverrides, rules, conditions] =
    await Promise.all([
      db.select().from(s.vehicleSizes).orderBy(asc(s.vehicleSizes.sort)),
      db.select().from(s.serviceCategories).orderBy(asc(s.serviceCategories.sort)),
      db.select().from(s.services).orderBy(asc(s.services.sort)),
      db.select().from(s.serviceSizePrices),
      db.select().from(s.packages).orderBy(asc(s.packages.sort)),
      db.select().from(s.packageItems),
      db.select().from(s.packageSizePrices),
      db.select().from(s.serviceRules),
      db.select().from(s.conditions).orderBy(asc(s.conditions.sort)),
    ]);

  const overridesFor = (rows: { sizeId: string; priceCents: number | null; durationMin: number | null }[]) => {
    const out: Record<string, SizeOverride> = {};
    for (const r of rows) out[r.sizeId] = { priceCents: r.priceCents, durationMin: r.durationMin };
    return out;
  };
  const categorySlug = new Map(categories.map((c) => [c.id, c.slug]));

  const serviceViews: ServiceView[] = services
    .filter((x) => !opts.activeOnly || x.active)
    .map((x) => ({
      id: x.id,
      slug: x.slug,
      name: x.name,
      kind: x.kind,
      categoryId: x.categoryId,
      categorySlug: x.categoryId ? (categorySlug.get(x.categoryId) ?? null) : null,
      basePriceCents: x.basePriceCents,
      baseDurationMin: x.baseDurationMin,
      quoteOnly: x.quoteOnly,
      locationTypes: x.locationTypes,
      active: x.active,
      sizeOverrides: overridesFor(serviceOverrides.filter((o) => o.serviceId === x.id)),
      summary: x.summary,
      descriptionMd: x.descriptionMd,
      includes: x.includes,
      whatToExpect: x.whatToExpect,
      seoTitle: x.seoTitle,
      seoDescription: x.seoDescription,
      isPlaceholder: x.isPlaceholder,
      sort: x.sort,
    }));

  const packageViews: PackageView[] = packages
    .filter((p) => !opts.activeOnly || p.active)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tier: p.tier,
      basePriceCents: p.basePriceCents,
      baseDurationMin: p.baseDurationMin,
      serviceIds: items.filter((i) => i.packageId === p.id).map((i) => i.serviceId),
      active: p.active,
      sizeOverrides: overridesFor(packageOverrides.filter((o) => o.packageId === p.id)),
      tagline: p.tagline,
      featured: p.featured,
      isPlaceholder: p.isPlaceholder,
      sort: p.sort,
    }));

  return {
    sizes: sizes
      .filter((z) => !opts.activeOnly || z.active)
      .map((z) => ({
        id: z.id,
        label: z.label,
        priceMultiplier: z.priceMultiplier,
        durationMultiplier: z.durationMultiplier,
        sort: z.sort,
      })),
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      sort: c.sort,
    })),
    services: serviceViews,
    packages: packageViews,
    rules: rules.map((r) => ({
      kind: r.kind,
      serviceId: r.serviceId,
      targetServiceId: r.targetServiceId,
      reason: r.reason,
    })),
    conditions: conditions
      .filter((c) => !opts.activeOnly || c.active)
      .map((c) => ({
        id: c.id,
        group: c.group,
        label: c.label,
        description: c.description,
        surchargeType: c.surchargeType,
        surchargeValue: c.surchargeValue,
        extraMinutes: c.extraMinutes,
        sort: c.sort,
      })),
  };
}

/** The engine-facing subset of a CatalogView. */
export function toEngineCatalog(view: CatalogView): Catalog {
  return {
    sizes: view.sizes,
    services: view.services,
    packages: view.packages,
    rules: view.rules,
    conditions: view.conditions,
  };
}
