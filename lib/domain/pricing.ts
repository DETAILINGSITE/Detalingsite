/**
 * Pricing + rules engine (docs/PLAN.md §5.1). Pure and deterministic.
 * The server always recomputes prices with this from the raw selection — client
 * totals are never trusted.
 */
import {
  indexCatalog,
  type Catalog,
  type CatalogPackage,
  type CatalogService,
  type LocationType,
  type Promo,
  type VehicleSize,
} from "./catalog";
import {
  applyMultiplier,
  basisPointsOf,
  percentOf,
  roundToStep,
  roundUpTo,
  scaleMinutes,
} from "./money";
import type { DepositPolicy } from "./settings";

export interface Selection {
  sizeId: string;
  packageId?: string | null;
  serviceIds: string[];
  addonIds: string[];
  conditionIds: string[];
  locationType?: LocationType | null;
}

/** A price locked by the owner on a quote request. */
export interface QuoteTerms {
  label: string;
  priceCents: number;
  durationMin: number;
  depositCents?: number | null;
}

export interface PricingContext {
  catalog: Catalog;
  deposit: DepositPolicy;
  taxRateBps: number;
  taxTravel: boolean;
  priceRoundingCents: number;
  /** Already-resolved zone travel fee; only charged for mobile jobs. */
  travelFeeCents?: number;
  promo?: Promo | null;
  quote?: QuoteTerms | null;
  /** Longest opening interval; longer jobs go down the quote path. 0 disables the check. */
  maxJobMinutes: number;
}

export type PriceLineKind =
  | "package"
  | "service"
  | "addon"
  | "surcharge"
  | "travel"
  | "discount"
  | "tax"
  | "quote";

export interface PriceLine {
  kind: PriceLineKind;
  id?: string;
  label: string;
  amountCents: number;
  durationMin: number;
  note?: string;
}

export type PriceNote =
  | {
      code: "auto_added";
      serviceId: string;
      serviceName: string;
      requiredById: string;
      requiredByName: string;
      reason: string;
    }
  | { code: "included_in_package"; serviceId: string; serviceName: string; packageName: string };

export type PriceError =
  | { code: "unknown_size"; id: string }
  | { code: "unknown_item"; id: string }
  | { code: "inactive_item"; id: string }
  | { code: "empty_selection" }
  | { code: "addons_only" }
  | {
      code: "excludes";
      serviceId: string;
      targetServiceId: string;
      serviceName: string;
      targetName: string;
      reason: string;
    }
  | { code: "location_unavailable"; serviceId: string; serviceName: string; locationType: LocationType };

export type QuoteReason =
  | { code: "quote_only"; serviceIds: string[] }
  | { code: "too_long"; durationMin: number; maxMinutes: number };

export interface PriceResult {
  ok: boolean;
  route: "book" | "quote";
  quoteReasons: QuoteReason[];
  lines: PriceLine[];
  notes: PriceNote[];
  errors: PriceError[];
  /** Every service the job includes: package items + chosen + auto-added. */
  resolvedServiceIds: string[];
  subtotalCents: number;
  surchargeCents: number;
  travelFeeCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  durationMin: number;
}

/** Duration granularity for scheduling. */
export const DURATION_STEP_MIN = 15;

export function priceForItem(
  item: Pick<CatalogService | CatalogPackage, "basePriceCents" | "sizeOverrides">,
  size: VehicleSize,
  roundingCents: number,
): number {
  const override = item.sizeOverrides[size.id]?.priceCents;
  if (override != null) return override;
  return roundToStep(applyMultiplier(item.basePriceCents, size.priceMultiplier), roundingCents);
}

export function durationForItem(
  item: Pick<CatalogService | CatalogPackage, "baseDurationMin" | "sizeOverrides">,
  size: VehicleSize,
): number {
  const override = item.sizeOverrides[size.id]?.durationMin;
  if (override != null) return override;
  return scaleMinutes(item.baseDurationMin, size.durationMultiplier);
}

export function depositFor(totalCents: number, policy: DepositPolicy): number {
  switch (policy.mode) {
    case "none":
      return 0;
    case "fixed":
      return Math.min(policy.valueCents, totalCents);
    case "percent":
      return Math.min(percentOf(totalCents, policy.percent), totalCents);
  }
}

function emptyResult(errors: PriceError[]): PriceResult {
  return {
    ok: false,
    route: "book",
    quoteReasons: [],
    lines: [],
    notes: [],
    errors,
    resolvedServiceIds: [],
    subtotalCents: 0,
    surchargeCents: 0,
    travelFeeCents: 0,
    discountCents: 0,
    taxCents: 0,
    totalCents: 0,
    depositCents: 0,
    balanceCents: 0,
    durationMin: 0,
  };
}

function finalize(
  ctx: PricingContext,
  base: {
    lines: PriceLine[];
    notes: PriceNote[];
    errors: PriceError[];
    quoteReasons: QuoteReason[];
    resolvedServiceIds: string[];
    subtotalCents: number;
    surchargeCents: number;
    travelFeeCents: number;
    discountCents: number;
    rawDurationMin: number;
    depositOverride?: number | null;
  },
): PriceResult {
  const taxBase =
    base.subtotalCents +
    base.surchargeCents -
    base.discountCents +
    (ctx.taxTravel ? base.travelFeeCents : 0);
  const taxCents = basisPointsOf(Math.max(0, taxBase), ctx.taxRateBps);
  const lines = [...base.lines];
  if (taxCents > 0) lines.push({ kind: "tax", label: "Tax", amountCents: taxCents, durationMin: 0 });

  const totalCents =
    base.subtotalCents + base.surchargeCents + base.travelFeeCents - base.discountCents + taxCents;
  const depositCents =
    base.depositOverride != null
      ? Math.min(base.depositOverride, totalCents)
      : depositFor(totalCents, ctx.deposit);
  const durationMin = roundUpTo(base.rawDurationMin, DURATION_STEP_MIN);

  const quoteReasons = [...base.quoteReasons];
  if (ctx.maxJobMinutes > 0 && durationMin > ctx.maxJobMinutes && !ctx.quote) {
    quoteReasons.push({ code: "too_long", durationMin, maxMinutes: ctx.maxJobMinutes });
  }

  return {
    ok: base.errors.length === 0,
    route: quoteReasons.length > 0 ? "quote" : "book",
    quoteReasons,
    lines,
    notes: base.notes,
    errors: base.errors,
    resolvedServiceIds: base.resolvedServiceIds,
    subtotalCents: base.subtotalCents,
    surchargeCents: base.surchargeCents,
    travelFeeCents: base.travelFeeCents,
    discountCents: base.discountCents,
    taxCents,
    totalCents,
    depositCents,
    balanceCents: totalCents - depositCents,
    durationMin,
  };
}

export function price(selection: Selection, ctx: PricingContext): PriceResult {
  const idx = indexCatalog(ctx.catalog);
  const size = idx.sizes.get(selection.sizeId);
  if (!size) return emptyResult([{ code: "unknown_size", id: selection.sizeId }]);

  // ── Quote path: the owner's price is locked; catalog items are ignored. ──
  if (ctx.quote) {
    return finalize(ctx, {
      lines: [
        {
          kind: "quote",
          label: ctx.quote.label,
          amountCents: ctx.quote.priceCents,
          durationMin: ctx.quote.durationMin,
        },
      ],
      notes: [],
      errors: [],
      quoteReasons: [],
      resolvedServiceIds: [],
      subtotalCents: ctx.quote.priceCents,
      surchargeCents: 0,
      travelFeeCents: 0,
      discountCents: 0,
      rawDurationMin: ctx.quote.durationMin,
      depositOverride: ctx.quote.depositCents ?? null,
    });
  }

  const errors: PriceError[] = [];
  const notes: PriceNote[] = [];

  // ── Package ──
  let pkg: CatalogPackage | null = null;
  if (selection.packageId) {
    const found = idx.packages.get(selection.packageId);
    if (!found) errors.push({ code: "unknown_item", id: selection.packageId });
    else if (!found.active) errors.push({ code: "inactive_item", id: found.id });
    else pkg = found;
  }
  const included = new Set(pkg?.serviceIds ?? []);

  // ── Requested services/add-ons (deduped, in order) ──
  const chosen: string[] = [];
  const auto = new Set<string>();
  for (const id of [...selection.serviceIds, ...selection.addonIds]) {
    if (chosen.includes(id)) continue;
    const svc = idx.services.get(id);
    if (!svc) {
      errors.push({ code: "unknown_item", id });
      continue;
    }
    if (!svc.active) {
      errors.push({ code: "inactive_item", id });
      continue;
    }
    if (included.has(id) && pkg) {
      notes.push({
        code: "included_in_package",
        serviceId: id,
        serviceName: svc.name,
        packageName: pkg.name,
      });
      continue;
    }
    chosen.push(id);
  }

  // ── Prerequisites: closure over "requires" rules ──
  const present = () => new Set([...included, ...chosen]);
  let changed = true;
  while (changed) {
    changed = false;
    const all = present();
    for (const rule of ctx.catalog.rules) {
      if (rule.kind !== "requires") continue;
      if (!all.has(rule.serviceId) || all.has(rule.targetServiceId)) continue;
      const target = idx.services.get(rule.targetServiceId);
      const requiredBy = idx.services.get(rule.serviceId);
      if (!target || !target.active || !requiredBy) continue;
      chosen.push(target.id);
      auto.add(target.id);
      notes.push({
        code: "auto_added",
        serviceId: target.id,
        serviceName: target.name,
        requiredById: requiredBy.id,
        requiredByName: requiredBy.name,
        reason: rule.reason,
      });
      changed = true;
      break; // restart with the updated set so ordering stays deterministic
    }
  }

  const resolved = [...present()];

  // ── Incompatible combinations ──
  const all = present();
  for (const rule of ctx.catalog.rules) {
    if (rule.kind !== "excludes") continue;
    if (all.has(rule.serviceId) && all.has(rule.targetServiceId)) {
      errors.push({
        code: "excludes",
        serviceId: rule.serviceId,
        targetServiceId: rule.targetServiceId,
        serviceName: idx.services.get(rule.serviceId)?.name ?? rule.serviceId,
        targetName: idx.services.get(rule.targetServiceId)?.name ?? rule.targetServiceId,
        reason: rule.reason,
      });
    }
  }

  // ── Must contain a main service (not only add-ons) ──
  if (!pkg) {
    if (chosen.length === 0) errors.push({ code: "empty_selection" });
    else if (!chosen.some((id) => idx.services.get(id)?.kind === "service"))
      errors.push({ code: "addons_only" });
  }

  // ── Location availability ──
  if (selection.locationType) {
    for (const id of resolved) {
      const svc = idx.services.get(id);
      if (svc && !svc.locationTypes.includes(selection.locationType)) {
        errors.push({
          code: "location_unavailable",
          serviceId: id,
          serviceName: svc.name,
          locationType: selection.locationType,
        });
      }
    }
  }

  // ── Quote-only items route the customer to a custom quote ──
  const quoteReasons: QuoteReason[] = [];
  const quoteOnly = resolved.filter((id) => idx.services.get(id)?.quoteOnly);
  if (quoteOnly.length > 0) quoteReasons.push({ code: "quote_only", serviceIds: quoteOnly });

  // ── Lines ──
  const lines: PriceLine[] = [];
  let rawDuration = 0;
  if (pkg) {
    const amount = priceForItem(pkg, size, ctx.priceRoundingCents);
    const duration = durationForItem(pkg, size);
    lines.push({ kind: "package", id: pkg.id, label: pkg.name, amountCents: amount, durationMin: duration });
    rawDuration += duration;
  }
  for (const id of chosen) {
    const svc = idx.services.get(id);
    if (!svc) continue;
    const amount = priceForItem(svc, size, ctx.priceRoundingCents);
    const duration = durationForItem(svc, size);
    lines.push({
      kind: svc.kind === "addon" ? "addon" : "service",
      id,
      label: svc.name,
      amountCents: amount,
      durationMin: duration,
      ...(auto.has(id) ? { note: "Required — added automatically" } : {}),
    });
    rawDuration += duration;
  }
  const subtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);

  // ── Condition surcharges ──
  let surchargeCents = 0;
  for (const cid of selection.conditionIds) {
    const cond = idx.conditions.get(cid);
    if (!cond) {
      errors.push({ code: "unknown_item", id: cid });
      continue;
    }
    const amount =
      cond.surchargeType === "flat" ? cond.surchargeValue : percentOf(subtotalCents, cond.surchargeValue);
    rawDuration += cond.extraMinutes;
    if (amount > 0 || cond.extraMinutes > 0) {
      lines.push({
        kind: "surcharge",
        id: cond.id,
        label: cond.label,
        amountCents: amount,
        durationMin: cond.extraMinutes,
      });
    }
    surchargeCents += amount;
  }

  // ── Travel ──
  const travelFeeCents =
    selection.locationType === "mobile" ? Math.max(0, ctx.travelFeeCents ?? 0) : 0;
  if (travelFeeCents > 0)
    lines.push({ kind: "travel", label: "Travel fee", amountCents: travelFeeCents, durationMin: 0 });

  // ── Promo (never discounts travel or surcharges) ──
  let discountCents = 0;
  if (ctx.promo) {
    const raw =
      ctx.promo.kind === "percent" ? percentOf(subtotalCents, ctx.promo.value) : ctx.promo.value;
    discountCents = Math.min(subtotalCents, Math.max(0, raw));
    if (discountCents > 0)
      lines.push({
        kind: "discount",
        id: ctx.promo.id,
        label: `Promo ${ctx.promo.code}`,
        amountCents: -discountCents,
        durationMin: 0,
      });
  }

  return finalize(ctx, {
    lines,
    notes,
    errors,
    quoteReasons,
    resolvedServiceIds: resolved,
    subtotalCents,
    surchargeCents,
    travelFeeCents,
    discountCents,
    rawDurationMin: rawDuration,
  });
}

/** Lowest price of an item across sizes — for "from $X" labels. */
export function fromPrice(
  item: Pick<CatalogService | CatalogPackage, "basePriceCents" | "sizeOverrides">,
  sizes: VehicleSize[],
  roundingCents: number,
): number {
  if (sizes.length === 0) return item.basePriceCents;
  return Math.min(...sizes.map((s) => priceForItem(item, s, roundingCents)));
}

/** Human-readable explanation of an engine error, for the wizard and the API. */
export function describePriceError(e: PriceError): string {
  switch (e.code) {
    case "unknown_size":
      return "Please choose a vehicle size.";
    case "unknown_item":
    case "inactive_item":
      return "One of the selected services is no longer available. Please review your selection.";
    case "empty_selection":
      return "Choose a package or at least one service.";
    case "addons_only":
      return "Add-ons need a main service or package. Choose one to continue.";
    case "excludes":
      return `${e.serviceName} can't be combined with ${e.targetName}: ${e.reason}`;
    case "location_unavailable":
      return e.locationType === "mobile"
        ? `${e.serviceName} is only available at our shop.`
        : `${e.serviceName} is only available as a mobile service.`;
  }
}
