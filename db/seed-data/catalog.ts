/**
 * Seed catalog. The four detail packages and the five add-ons come from the owner's price
 * flyer (`real: true`) — their prices are real, but DURATIONS ARE ESTIMATES. Every other row
 * is still a placeholder. The owner reviews all of it in /admin/catalog and ticks "Catalog
 * reviewed" (settings.catalogReviewed) before launch. Rows are marked is_placeholder = true
 * until they're real or edited in admin.
 *
 * The flyer prices "cars" and "trucks & SUVs"; vans aren't listed, so they use the truck/SUV price.
 */

export const seedSizes = [
  { id: "sedan", label: "Sedan / Coupe", description: "Cars, coupes and hatchbacks", priceMultiplier: 1.0, durationMultiplier: 1.0, sort: 1 },
  { id: "suv", label: "SUV / Crossover", description: "Small to mid-size SUVs and crossovers", priceMultiplier: 1.2, durationMultiplier: 1.15, sort: 2 },
  { id: "truck", label: "Truck", description: "Pickups and full-size SUVs", priceMultiplier: 1.3, durationMultiplier: 1.25, sort: 3 },
  { id: "van", label: "Van / Minivan", description: "Minivans and passenger vans", priceMultiplier: 1.35, durationMultiplier: 1.3, sort: 4 },
] as const;

export const seedCategories = [
  { slug: "detail-packages", name: "Detail packages", description: "Four tiers, from a routine maintenance wash to a full showroom finish.", sort: 0 },
  { slug: "exterior", name: "Exterior", description: "Wash, decontamination and protection for paint, glass and wheels.", sort: 1 },
  { slug: "interior", name: "Interior", description: "Deep cleaning for seats, carpets, plastics and odours.", sort: 2 },
  { slug: "paint-protection", name: "Paint correction & protection", description: "Swirl removal, ceramic coatings and film.", sort: 3 },
  { slug: "specialty", name: "Specialty & commercial", description: "Boats, RVs, fleets and one-off jobs.", sort: 4 },
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

/** Flyer pricing: one price for cars, one for trucks & SUVs (applied to SUVs, trucks and vans). */
const carVsTruck = (truckSuvCents: number): SeedSizeOverrides => ({
  suv: { priceCents: truckSuvCents },
  truck: { priceCents: truckSuvCents },
  van: { priceCents: truckSuvCents },
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
    summary: "Everything in Gold, plus one-step paint correction and a 1-year ceramic coating. Trucks & SUVs start at $550+.",
    descriptionMd:
      "The full showroom treatment. On top of the Gold full detail: iron decontamination, a one-step paint correction, a 1-year ceramic coating, the engine bay detailed, headlights restored if needed, a premium finishing inspection and a free maintenance wash within 30 days. Cars start at $450; trucks and SUVs start at $550+.",
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
    slug: "paint-decontamination",
    category: "paint-protection",
    kind: "addon",
    name: "Paint decontamination",
    summary: "Iron remover and clay bar to strip bonded contamination.",
    descriptionMd: "Chemical iron removal and a full clay-bar pass. Required before any coating so it bonds to bare, clean paint.",
    includes: ["Iron fallout remover", "Tar removal", "Clay bar on all painted surfaces"],
    whatToExpect: [],
    basePriceCents: 6900,
    baseDurationMin: 45,
    locationTypes: BOTH,
    sort: 10,
  },
  {
    slug: "paint-correction-1-stage",
    category: "paint-protection",
    kind: "service",
    name: "Paint correction — 1-stage",
    summary: "Single-step machine polish that removes light swirls and restores gloss.",
    descriptionMd: "A one-step machine polish that removes roughly 50–70% of light swirls and haze and dramatically increases gloss. Ideal before a coating on newer paint.",
    includes: ["Paint depth readings", "Taping of trim and badges", "One-step compound/polish"],
    whatToExpect: ["Done in our shop or a covered garage — direct sun and wind affect polishing"],
    basePriceCents: 39900,
    baseDurationMin: 300,
    locationTypes: ["shop"],
    sort: 11,
  },
  {
    slug: "paint-correction-2-stage",
    category: "paint-protection",
    kind: "service",
    name: "Paint correction — 2-stage",
    summary: "Cut and polish for deeper swirls, water spots and oxidation.",
    descriptionMd: "A heavier compounding step followed by a refining polish. Removes most swirls, haze and moderate defects for a near-flawless finish.",
    includes: ["Paint depth readings", "Compounding stage", "Refining polish stage", "Panel wipe inspection"],
    whatToExpect: ["Shop only", "Many vehicles need more than a day — larger vehicles are quoted"],
    basePriceCents: 69900,
    baseDurationMin: 480,
    locationTypes: ["shop"],
    sort: 12,
    sizeOverrides: { truck: { durationMin: 600 }, van: { durationMin: 600 } },
  },
  {
    slug: "ceramic-coating",
    category: "paint-protection",
    kind: "addon",
    name: "1-year ceramic coating",
    summary: "Starting at $100: a 1-year ceramic coating, without paint correction.",
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
    slug: "paint-protection-film",
    category: "paint-protection",
    kind: "service",
    name: "Paint protection film (PPF)",
    summary: "Clear film against rock chips and scratches — quoted per vehicle.",
    descriptionMd: "Self-healing clear film on high-impact areas or the whole car. Coverage and pricing depend on the vehicle, so we'll send you a quote.",
    includes: ["Coverage consultation", "Precision-cut film", "Edge wrapping where possible"],
    whatToExpect: ["Shop only", "Usually 1–3 days depending on coverage"],
    basePriceCents: 0,
    baseDurationMin: 480,
    quoteOnly: true,
    locationTypes: ["shop"],
    sort: 14,
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
    slug: "odor-ozone",
    category: "interior",
    kind: "addon",
    name: "Odour / ozone treatment",
    summary: "Neutralises smoke, pet and mildew odours at the source.",
    descriptionMd: "An ozone treatment that breaks down odour molecules in fabrics and the HVAC system, followed by ventilation.",
    includes: ["Ozone treatment", "HVAC cycle", "Ventilation"],
    whatToExpect: ["The vehicle must stay closed for about an hour"],
    basePriceCents: 7900,
    baseDurationMin: 60,
    locationTypes: BOTH,
    sort: 22,
  },
  {
    slug: "pet-hair-removal",
    category: "interior",
    kind: "addon",
    name: "Pet hair removal",
    summary: "Starting at $30: specialist tools to lift embedded pet hair.",
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
    summary: "Starting at $25: extra time for heavy mud and sand.",
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
  {
    slug: "boat-rv",
    category: "specialty",
    kind: "service",
    name: "Boat & RV detailing",
    summary: "Gelcoat, hull and interior care — quoted per vessel or coach.",
    descriptionMd: "Oxidation removal, polishing and protection for boats and RVs. Every job is different, so we quote it.",
    includes: ["Inspection and quote", "Wash, oxidation removal and polish", "Protection"],
    whatToExpect: [],
    basePriceCents: 0,
    baseDurationMin: 480,
    quoteOnly: true,
    locationTypes: BOTH,
    sort: 30,
  },
  {
    slug: "fleet-commercial",
    category: "specialty",
    kind: "service",
    name: "Fleet & commercial",
    summary: "Recurring service for company vehicles — volume pricing.",
    descriptionMd: "Scheduled washes and details for fleets of any size, on-site, with consolidated invoicing.",
    includes: ["On-site service", "Recurring schedule", "Monthly invoicing"],
    whatToExpect: [],
    basePriceCents: 0,
    baseDurationMin: 240,
    quoteOnly: true,
    locationTypes: BOTH,
    sort: 31,
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
  {
    kind: "requires" as const,
    service: "paint-correction-2-stage",
    target: "paint-decontamination",
    reason: "Polishing over bonded contamination drags it across the paint and creates new scratches.",
  },
  {
    kind: "requires" as const,
    service: "paint-correction-1-stage",
    target: "paint-decontamination",
    reason: "Polishing over bonded contamination drags it across the paint and creates new scratches.",
  },
  {
    kind: "excludes" as const,
    service: "paint-correction-1-stage",
    target: "paint-correction-2-stage",
    reason: "Choose one level of paint correction.",
  },
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
  { kind: "excludes" as const, service: "vip-showroom-finish", target: "paint-decontamination", reason: "VIP already includes iron decontamination." },
  { kind: "excludes" as const, service: "vip-showroom-finish", target: "paint-correction-1-stage", reason: "VIP already includes a one-step paint correction." },
];

export const seedConditions = [
  { id: "light", group: "soil" as const, label: "Light — regular upkeep", description: "Washed in the last month, light dust.", surchargeType: "flat" as const, surchargeValue: 0, extraMinutes: 0, sort: 1 },
  { id: "moderate", group: "soil" as const, label: "Moderate — needs some love", description: "Crumbs, some stains, road film.", surchargeType: "flat" as const, surchargeValue: 2500, extraMinutes: 30, sort: 2 },
  { id: "heavy", group: "soil" as const, label: "Heavy — it's been a while", description: "Heavy soiling, mud, sand, spills.", surchargeType: "percent" as const, surchargeValue: 20, extraMinutes: 60, sort: 3 },
  { id: "pet_hair", group: "extra" as const, label: "Pet hair", description: "Noticeable pet hair in the cabin.", surchargeType: "flat" as const, surchargeValue: 3000, extraMinutes: 30, sort: 4 },
  { id: "stains", group: "extra" as const, label: "Stains", description: "Visible stains on seats or carpets.", surchargeType: "flat" as const, surchargeValue: 2500, extraMinutes: 30, sort: 5 },
] as const;
