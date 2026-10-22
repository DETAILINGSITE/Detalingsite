import { describe, expect, it } from "vitest";
import { durationForItem, price, priceForItem } from "@/lib/domain/pricing";
import { applyMultiplier, roundToStep } from "@/lib/domain/money";
import { catalog, ctx, sel } from "./fixtures";

describe("U-PRICE pricing engine", () => {
  it("U-PRICE-01 every service × every size: override wins, else base × multiplier rounded", () => {
    for (const service of catalog.services.filter((s) => s.active && !s.quoteOnly)) {
      for (const size of catalog.sizes) {
        const r = price(sel({ sizeId: size.id, serviceIds: [service.kind === "service" ? service.id : "wash"], addonIds: service.kind === "addon" ? [service.id] : [] }), ctx());
        expect(r.ok, `${service.id}/${size.id}`).toBe(true);
        const line = r.lines.find((l) => l.id === service.id)!;
        const expected = service.sizeOverrides[size.id]?.priceCents ?? roundToStep(applyMultiplier(service.basePriceCents, size.priceMultiplier), 100);
        expect(line.amountCents).toBe(expected);
        expect(line.durationMin).toBe(durationForItem(service, size));
      }
    }
  });

  it("U-PRICE-02 SUV/truck multipliers applied everywhere (scenario 2)", () => {
    const sedan = price(sel({ serviceIds: ["interior"] }), ctx());
    const suv = price(sel({ sizeId: "suv", serviceIds: ["interior"] }), ctx());
    const truck = price(sel({ sizeId: "truck", serviceIds: ["interior"] }), ctx());
    expect(sedan.subtotalCents).toBe(14900);
    expect(suv.subtotalCents).toBe(17900); // 14900 × 1.2 = 17880 → nearest dollar 17900
    expect(truck.subtotalCents).toBe(19400); // 14900 × 1.3 = 19370 → 19400
    expect(suv.durationMin).toBe(180); // ceil(150 × 1.15)=173 → round up to 15 → 180
  });

  it("U-PRICE-03 per-size override beats multiplier (price and duration)", () => {
    const r = price(sel({ sizeId: "truck", serviceIds: ["pc2"] }), ctx());
    expect(r.subtotalCents).toBe(99900);
    expect(r.durationMin).toBe(600);
  });

  it("U-PRICE-04 package priced as one line; package override per size", () => {
    expect(price(sel({ packageId: "premium" }), ctx()).subtotalCents).toBe(27900);
    expect(price(sel({ sizeId: "van", packageId: "premium" }), ctx()).subtotalCents).toBe(39900);
  });

  it("U-PRICE-05 package + 2 add-ons (scenario 1)", () => {
    const r = price(sel({ packageId: "premium", addonIds: ["headlight", "engine"] }), ctx());
    expect(r.subtotalCents).toBe(27900 + 7900 + 5900);
    expect(r.durationMin).toBe(270 + 60 + 45);
    expect(r.depositCents).toBe(5000);
    expect(r.balanceCents).toBe(r.totalCents - 5000);
  });

  it("U-RULES-01 prerequisite is auto-added with an explanation", () => {
    const r = price(sel({ serviceIds: ["ceramic"] }), ctx());
    expect(r.ok).toBe(true);
    expect(r.resolvedServiceIds).toContain("decon");
    expect(r.lines.find((l) => l.id === "decon")?.note).toMatch(/added automatically/);
    expect(r.notes[0]).toMatchObject({ code: "auto_added", serviceId: "decon", requiredById: "ceramic" });
    expect(r.subtotalCents).toBe(59900 + 6900);
  });

  it("U-RULES-02 prerequisite already in the package is not charged twice", () => {
    const r = price(sel({ packageId: "premium", serviceIds: ["ceramic"] }), ctx());
    expect(r.lines.filter((l) => l.id === "decon")).toHaveLength(0);
    expect(r.notes.some((n) => n.code === "auto_added")).toBe(false);
  });

  it("U-RULES-03 selecting a service included in the package is deduped with a note", () => {
    const r = price(sel({ packageId: "premium", serviceIds: ["wash"] }), ctx());
    expect(r.subtotalCents).toBe(27900);
    expect(r.notes[0]).toMatchObject({ code: "included_in_package", serviceId: "wash" });
  });

  it("U-RULES-04 incompatible combination is an error", () => {
    const r = price(sel({ serviceIds: ["pc1", "pc2"] }), ctx());
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "excludes")).toBe(true);
  });

  it("U-RULES-05 quote-only routes to the quote path", () => {
    const r = price(sel({ serviceIds: ["ppf"] }), ctx());
    expect(r.route).toBe("quote");
    expect(r.quoteReasons[0]).toEqual({ code: "quote_only", serviceIds: ["ppf"] });
  });

  it("U-RULES-06 job longer than the longest business day routes to quote", () => {
    const r = price(sel({ serviceIds: ["pc2", "ceramic"] }), ctx({ maxJobMinutes: 600 }));
    expect(r.route).toBe("quote");
    expect(r.quoteReasons.some((q) => q.code === "too_long")).toBe(true);
  });

  it("U-RULES-07 empty, add-ons only, unknown and inactive items are errors", () => {
    expect(price(sel(), ctx()).errors[0]?.code).toBe("empty_selection");
    expect(price(sel({ addonIds: ["engine"] }), ctx()).errors[0]?.code).toBe("addons_only");
    expect(price(sel({ serviceIds: ["nope"] }), ctx()).errors[0]?.code).toBe("unknown_item");
    expect(price(sel({ serviceIds: ["retired"] }), ctx()).errors[0]?.code).toBe("inactive_item");
    expect(price(sel({ sizeId: "bus", serviceIds: ["wash"] }), ctx()).errors[0]?.code).toBe("unknown_size");
  });

  it("U-RULES-08 location availability", () => {
    const r = price(sel({ serviceIds: ["ceramic"], locationType: "mobile" }), ctx());
    expect(r.errors.some((e) => e.code === "location_unavailable")).toBe(true);
    expect(price(sel({ serviceIds: ["ceramic"], locationType: "shop" }), ctx()).ok).toBe(true);
  });

  it("U-PRICE-06 condition surcharges (flat and percent) and extra time", () => {
    const flat = price(sel({ serviceIds: ["interior"], conditionIds: ["moderate", "pet_hair"] }), ctx());
    expect(flat.surchargeCents).toBe(5500);
    expect(flat.durationMin).toBe(210);
    const pct = price(sel({ serviceIds: ["interior"], conditionIds: ["heavy"] }), ctx());
    expect(pct.surchargeCents).toBe(2980);
  });

  it("U-PRICE-07 travel fee only for mobile jobs", () => {
    expect(price(sel({ serviceIds: ["wash"], locationType: "mobile" }), ctx({ travelFeeCents: 2500 })).travelFeeCents).toBe(2500);
    expect(price(sel({ serviceIds: ["wash"], locationType: "shop" }), ctx({ travelFeeCents: 2500 })).travelFeeCents).toBe(0);
  });

  it("U-PRICE-08 promo: percent and fixed, capped at subtotal, never discounts travel", () => {
    const pct = price(sel({ serviceIds: ["interior"], locationType: "mobile" }), ctx({ travelFeeCents: 2500, promo: { id: "p", code: "TEN", kind: "percent", value: 10 } }));
    expect(pct.discountCents).toBe(1490);
    expect(pct.totalCents).toBe(14900 - 1490 + 2500);
    const huge = price(sel({ serviceIds: ["wash"] }), ctx({ promo: { id: "p", code: "BIG", kind: "fixed", value: 999999 } }));
    expect(huge.discountCents).toBe(8900);
    expect(huge.totalCents).toBe(0);
    expect(huge.depositCents).toBe(0);
  });

  it("U-PRICE-09 tax with and without travel", () => {
    const base = ctx({ taxRateBps: 825, travelFeeCents: 2000 });
    expect(price(sel({ serviceIds: ["interior"], locationType: "mobile" }), base).taxCents).toBe(1229); // 14900 × 8.25%
    expect(price(sel({ serviceIds: ["interior"], locationType: "mobile" }), { ...base, taxTravel: true }).taxCents).toBe(1394);
  });

  it("U-PRICE-10 deposit modes", () => {
    const s0 = sel({ serviceIds: ["interior"] });
    expect(price(s0, ctx({ deposit: { mode: "none" } })).depositCents).toBe(0);
    expect(price(s0, ctx({ deposit: { mode: "percent", percent: 25 } })).depositCents).toBe(3725);
    expect(price(sel({ serviceIds: ["wash"] }), ctx({ deposit: { mode: "fixed", valueCents: 50000 } })).depositCents).toBe(8900);
  });

  it("U-PRICE-11 locked quote price ignores catalog items", () => {
    const r = price(sel({ serviceIds: ["ppf"] }), ctx({ quote: { label: "Quote Q-1", priceCents: 120000, durationMin: 480, depositCents: 20000 } }));
    expect(r.route).toBe("book");
    expect(r.subtotalCents).toBe(120000);
    expect(r.depositCents).toBe(20000);
    expect(r.durationMin).toBe(480);
  });

  it("U-PRICE-12 total identity always holds", () => {
    const r = price(sel({ sizeId: "suv", packageId: "premium", addonIds: ["engine"], conditionIds: ["heavy"], locationType: "mobile" }), ctx({ travelFeeCents: 2500, taxRateBps: 700, promo: { id: "x", code: "X", kind: "percent", value: 15 } }));
    expect(r.totalCents).toBe(r.subtotalCents + r.surchargeCents + r.travelFeeCents - r.discountCents + r.taxCents);
    expect(r.lines.reduce((a, l) => a + l.amountCents, 0)).toBe(r.totalCents);
  });

  it("priceForItem rounding step", () => {
    expect(priceForItem({ basePriceCents: 14900, sizeOverrides: {} }, catalog.sizes[1]!, 500)).toBe(18000);
    expect(priceForItem({ basePriceCents: 14900, sizeOverrides: {} }, catalog.sizes[1]!, 1)).toBe(17880);
  });
});
