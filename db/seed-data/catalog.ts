/**
 * Seed catalog, taken from the owner's price flyer: four detail packages and five add-ons
 * (`real: true`). Prices are real but DURATIONS ARE ESTIMATES. The owner reviews everything in
 * /admin/catalog and ticks "Catalog reviewed" (settings.catalogReviewed) before launch.
 *
 * The flyer prices "cars" and "trucks & SUVs", so there are two vehicle sizes; vans are treated as
 * trucks/SUVs. Anything else (boats, fleets, PPF, ...) goes through the custom-quote flow.
 */

export const seedSizes = [
  { id: "sedan", label: "Car (sedan / coupe)", description: "Sedans, coupes and hatchbacks", priceMultiplier: 1.0, durationMultiplier: 1.0, sort: 1 },
  { id: "suv", label: "Truck / SUV / Van", description: "Trucks, SUVs, crossovers and vans", priceMultiplier: 1.2, durationMultiplier: 1.15, sort: 2 },
] as const;

export const seedCategories = [
  { slug: "detail-packages", name: "Detail packages", description: "Four tiers, from a routine maintenance wash to a full showroom finish.", sort: 0 },
  { slug: "exterior", name: "Exterior add-ons", description: "Extras for the outside of your vehicle.", sort: 1 },
  { slug: "interior", name: "Interior add-ons", description: "Extras for the inside of your vehicle.", sort: 2 },
] as const;

type Loc = "mobile" | "shop";
export interface SeedService {
  slug: string;
  category: (typeof seedCategories)[number]["slug"];
  kind: "service" | "addon";
  name: string;
  summary: string;
  descriptionMd: string;
  includes: string[];
  whatToExpect: string[];
  basePriceCents: number;
  baseDurationMin: number;
  quoteOnly?: boolean;
  locationTypes?: Loc[];
  sort: number;
  sizeOverrides?: SeedSizeOverrides;
  /** Price comes from the owner's flyer, so it isn't flagged as a sample. */
  real?: boolean;
}

type SeedSizeOverrides = Partial<Record<(typeof seedSizes)[number]["id"], { priceCents?: number; durationMin?: number }>>;

const BOTH: Loc[] = ["mobile", "shop"];

/** Flyer pricing: one price for cars, one for trucks, SUVs and vans. */
const carVsTruck = (truckSuvCents: number): SeedSizeOverrides => ({
  suv: { priceCents: truckSuvCents },
});
/** Flat add-on price regardless of vehicle size. */
const flat = (cents: number): SeedSizeOverrides => carVsTruck(cents);

export const seedServices: SeedService[] = [
  // ── Detail packages (owner's flyer) ──────────────────────────────────────────
  {
    slug: "bronze-maintenance-wash",
    category: "detail-packages",
    kind: "service",
    name: "Bronze — Maintenance wash",
    summary: "Great for routine maintenance: hand wash, wheels and tires, spray wax and a quick interior vacuum.",
    descriptionMd:
      "Our maintenance wash keeps a clean car clean. A careful hand wash, wheels and tires cleaned and shined, exterior windows, a spray wax that protects for 1–2 months, and a quick vacuum and dash wipe-down inside.",
    includes: [
      "Hand wash",
      "Wheels & tires cleaned",
      "Tire shine",
      "Exterior windows cleaned",
      "Spray wax protection (1–2 months)",
      "Quick interior vacuum",
      "Dash & console wipe down",
    ],
    whatToExpect: [],
    basePriceCents: 7500,
    baseDurationMin: 150,
    locationTypes: BOTH,
    sort: 1,
    sizeOverrides: carVsTruck(9500),
    real: true,
  },
  {
    slug: "silver-deep-interior-refresh",
    category: "detail-packages",
    kind: "service",
    name: "Silver — Deep interior refresh",
    summary: "Everything in Bronze, plus a complete interior vacuum, steam cleaning and stain treatment.",
    descriptionMd:
      "For cabins that need more than a wipe-down. On top of the Bronze maintenance wash, we vacuum the whole interior, steam clean, detail door jambs, vents and cup holders, clean and protect the plastics, and treat light stains.",
    includes: [
      "Everything in Bronze",
      "Complete interior vacuum",
      "Steam cleaning",
      "Door jambs cleaned",
      "Interior plastics cleaned & protected",
      "Cup holders & vents detailed",
      "Interior windows cleaned",
      "Light stain treatment",
    ],
    whatToExpect: [],
    basePriceCents: 15000,
    baseDurationMin: 210,
    locationTypes: BOTH,
    sort: 2,
    sizeOverrides: carVsTruck(17000),
    real: true,
  },
  {
    slug: "gold-full-detail",
    category: "detail-packages",
    kind: "service",
    name: "Gold — Full detail",
    summary: "Everything in Silver, plus a premium paint sealant, clay bar treatment and a full interior and exterior detail.",
    descriptionMd:
      "Our most popular package: the complete inside-and-out reset. Clay bar treatment (if needed) and a premium paint sealant for the paint, trim dressing, wheel wells, seats shampooed (cloth) or leather cleaned and conditioned, and a full interior and exterior detail.",
    includes: [
      "Everything in Silver",
      "Hand wash",
      "Clay bar treatment (if needed)",
      "Premium paint sealant",
      "Wheel wells cleaned",
      "Trim dressing",
      "Spray wax/protection",
      "Seats shampooed (cloth) or leather cleaned & conditioned",
      "Full interior detail",
      "Complete exterior detail",
    ],
    whatToExpect: [],
    basePriceCents: 20000,
    baseDurationMin: 270,
    locationTypes: BOTH,
    sort: 3,
    sizeOverrides: carVsTruck(22000),
    real: true,
  },
  {
    slug: "vip-showroom-finish",
    category: "detail-packages",
    kind: "service",
    name: "VIP — Showroom finish",
    summary: "Everything in Gold, plus one-step paint correction and a 1-year ceramic coating.",
    descriptionMd:
      "The full showroom treatment. On top of the Gold full detail: iron decontamination, a one-step paint correction, a 1-year ceramic coating, the engine bay detailed, headlights restored if needed, a premium finishing inspection and a free maintenance wash within 30 days. Cars are $450; trucks and SUVs are $550.",
    includes: [
      "Everything in Gold",
      "One-step paint correction",
      "1-year ceramic coating",
      "Engine bay detail",
      "Headlight restoration (if needed)",
      "Iron decontamination",
      "Premium finishing inspection",
      "Free maintenance wash within 30 days",
    ],
    whatToExpect: [],
    basePriceCents: 45000,
    baseDurationMin: 420,
    locationTypes: BOTH,
    sort: 4,
    sizeOverrides: carVsTruck(55000),
    real: true,
  },
  {
    slug: "ceramic-coating",
    category: "exterior",
    kind: "addon",
    name: "1-year ceramic coating",
    summary: "A 1-year ceramic coating, applied without paint correction.",
    descriptionMd: "A 1-year ceramic coating applied without paint correction. Repels water and dirt and makes washing easier. Starting at $100; the final price depends on the vehicle.",
    includes: ["1-year ceramic coating", "Applied without paint correction"],
    whatToExpect: [],
    basePriceCents: 10000,
    baseDurationMin: 120,
    locationTypes: BOTH,
    sort: 13,
    sizeOverrides: flat(10000),
    real: true,
  },
  {
    slug: "headlight-restoration",
    category: "exterior",
    kind: "addon",
    name: "Headlight restoration",
    summary: "Sand, polish and seal cloudy headlights.",
    descriptionMd: "Multi-stage wet sanding and polishing followed by a UV sealant to keep lenses clear.",
    includes: ["Both headlights", "UV-resistant sealant"],
    whatToExpect: [],
    basePriceCents: 4500,
    baseDurationMin: 60,
    locationTypes: BOTH,
    sort: 20,
    sizeOverrides: flat(4500),
    real: true,
  },
  {
    slug: "engine-bay",
    category: "exterior",
    kind: "addon",
    name: "Engine bay cleaning",
    summary: "Safe degrease, rinse and dress of the engine bay.",
    descriptionMd: "Electrical components are protected, then the bay is degreased, gently rinsed and dressed for a clean, factory look.",
    includes: ["Degrease", "Low-pressure rinse", "Plastic and rubber dressing"],
    whatToExpect: ["Engine must be cool"],
    basePriceCents: 2000,
    baseDurationMin: 45,
    locationTypes: BOTH,
    sort: 21,
    sizeOverrides: flat(2000),
    real: true,
  },
  {
    slug: "pet-hair-removal",
    category: "interior",
    kind: "addon",
    name: "Pet hair removal",
    summary: "Specialist tools to lift embedded pet hair.",
    descriptionMd: "Rubber brushes and air tools to pull embedded hair from carpets and upholstery. Starting at $30; heavier pet hair costs more.",
    includes: ["Carpets and seats", "Cargo area"],
    whatToExpect: [],
    basePriceCents: 3000,
    baseDurationMin: 45,
    locationTypes: BOTH,
    sort: 23,
    sizeOverrides: flat(3000),
    real: true,
  },
  {
    slug: "excessive-mud-sand",
    category: "exterior",
    kind: "addon",
    name: "Excessive mud / sand",
    summary: "Extra time and care for heavy mud and sand.",
    descriptionMd: "Heavy mud or sand takes extra time and care to remove safely. Starting at $25; the final price depends on how much there is.",
    includes: ["Heavy mud and sand removal"],
    whatToExpect: [],
    basePriceCents: 2500,
    baseDurationMin: 30,
    locationTypes: BOTH,
    sort: 24,
    sizeOverrides: flat(2500),
    real: true,
  },
];

/** The flyer's four tiers. Each package wraps the tier service of the same name (prices match). */
export const seedPackages: {
  slug: string;
  name: string;
  tier: number;
  tagline: string;
  basePriceCents: number;
  baseDurationMin: number;
  featured: boolean;
  services: string[];
  sort: number;
  sizeOverrides: SeedSizeOverrides;
}[] = [
  {
    slug: "bronze",
    name: "Bronze",
    tier: 1,
    tagline: "Maintenance wash — great for routine upkeep.",
    basePriceCents: 7500,
    baseDurationMin: 150,
    featured: false,
    services: ["bronze-maintenance-wash"],
    sort: 1,
    sizeOverrides: carVsTruck(9500),
  },
  {
    slug: "silver",
    name: "Silver",
    tier: 2,
    tagline: "Deep interior refresh.",
    basePriceCents: 15000,
    baseDurationMin: 210,
    featured: false,
    services: ["silver-deep-interior-refresh"],
    sort: 2,
    sizeOverrides: carVsTruck(17000),
  },
  {
    slug: "gold",
    name: "Gold",
    tier: 3,
    tagline: "Full detail, inside and out.",
    basePriceCents: 20000,
    baseDurationMin: 270,
    featured: true,
    services: ["gold-full-detail"],
    sort: 3,
    sizeOverrides: carVsTruck(22000),
  },
  {
    slug: "vip",
    name: "VIP",
    tier: 4,
    tagline: "Showroom finish, with paint correction and ceramic coating.",
    basePriceCents: 45000,
    baseDurationMin: 420,
    featured: false,
    services: ["vip-showroom-finish"],
    sort: 4,
    sizeOverrides: carVsTruck(55000),
  },
];

export const seedRules = [
  // Each tier already includes everything in the tiers below it.
  { kind: "excludes" as const, service: "silver-deep-interior-refresh", target: "bronze-maintenance-wash", reason: "Silver already includes everything in Bronze." },
  { kind: "excludes" as const, service: "gold-full-detail", target: "silver-deep-interior-refresh", reason: "Gold already includes everything in Silver." },
  { kind: "excludes" as const, service: "gold-full-detail", target: "bronze-maintenance-wash", reason: "Gold already includes everything in Bronze." },
  { kind: "excludes" as const, service: "vip-showroom-finish", target: "gold-full-detail", reason: "VIP already includes everything in Gold." },
  { kind: "excludes" as const, service: "vip-showroom-finish", target: "silver-deep-interior-refresh", reason: "VIP already includes everything in Silver." },
  { kind: "excludes" as const, service: "vip-showroom-finish", target: "bronze-maintenance-wash", reason: "VIP already includes everything in Bronze." },
  // VIP already includes these add-ons.
  { kind: "excludes" as const, service: "vip-showroom-finish", target: "ceramic-coating", reason: "VIP already includes a 1-year ceramic coating." },
  { kind: "excludes" as const, service: "vip-showroom-finish", target: "engine-bay", reason: "VIP already includes the engine bay detail." },
  { kind: "excludes" as const, service: "vip-showroom-finish", target: "headlight-restoration", reason: "VIP already includes headlight restoration (if needed)." },
];

export const seedConditions = [
  { id: "light", group: "soil" as const, label: "Light — regular upkeep", description: "Washed in the last month, light dust.", surchargeType: "flat" as const, surchargeValue: 0, extraMinutes: 0, sort: 1 },
  { id: "moderate", group: "soil" as const, label: "Moderate — needs some love", description: "Crumbs, some stains, road film.", surchargeType: "flat" as const, surchargeValue: 2500, extraMinutes: 30, sort: 2 },
  { id: "heavy", group: "soil" as const, label: "Heavy — it's been a while", description: "Heavy soiling, mud, sand, spills.", surchargeType: "percent" as const, surchargeValue: 20, extraMinutes: 60, sort: 3 },
  { id: "stains", group: "extra" as const, label: "Stains", description: "Visible stains on seats or carpets.", surchargeType: "flat" as const, surchargeValue: 2500, extraMinutes: 30, sort: 5 },
] as const;
