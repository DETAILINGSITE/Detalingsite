/**
 * Seed catalog. ALL PRICES AND DURATIONS ARE PLACEHOLDERS — the owner reviews them in
 * /admin/catalog and ticks "Catalog reviewed" (settings.catalogReviewed) before launch.
 * Rows are marked is_placeholder = true until edited in admin.
 */

export const seedSizes = [
  { id: "sedan", label: "Sedan / Coupe", description: "Cars, coupes and hatchbacks", priceMultiplier: 1.0, durationMultiplier: 1.0, sort: 1 },
  { id: "suv", label: "SUV / Crossover", description: "Small to mid-size SUVs and crossovers", priceMultiplier: 1.2, durationMultiplier: 1.15, sort: 2 },
  { id: "truck", label: "Truck", description: "Pickups and full-size SUVs", priceMultiplier: 1.3, durationMultiplier: 1.25, sort: 3 },
  { id: "van", label: "Van / Minivan", description: "Minivans and passenger vans", priceMultiplier: 1.35, durationMultiplier: 1.3, sort: 4 },
] as const;

export const seedCategories = [
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
  sizeOverrides?: Partial<Record<(typeof seedSizes)[number]["id"], { priceCents?: number; durationMin?: number }>>;
}

const BOTH: Loc[] = ["mobile", "shop"];

export const seedServices: SeedService[] = [
  {
    slug: "exterior-wash-wax",
    category: "exterior",
    kind: "service",
    name: "Exterior wash & wax",
    summary: "Hand wash, wheels, tyres and a durable spray wax for a deep gloss.",
    descriptionMd:
      "A careful two-bucket hand wash that's safe on your paint, followed by wheel and tyre cleaning, glass inside and out, and a spray wax that adds gloss and a few weeks of protection.",
    includes: ["Foam pre-wash and two-bucket hand wash", "Wheels, tyres and wheel wells", "Streak-free glass", "Spray wax and tyre dressing"],
    whatToExpect: ["We'll need about 1.5 m of space around the vehicle", "Unlock the car so we can do the door jambs"],
    basePriceCents: 8900,
    baseDurationMin: 90,
    locationTypes: BOTH,
    sort: 1,
  },
  {
    slug: "interior-refresh",
    category: "interior",
    kind: "service",
    name: "Interior refresh",
    summary: "Vacuum, wipe-down and glass — a quick reset between deep cleans.",
    descriptionMd:
      "A thorough vacuum of seats, carpets and mats, a wipe-down of dash, doors and console, and streak-free interior glass.",
    includes: ["Vacuum seats, carpets and mats", "Wipe-down of hard surfaces", "Interior glass"],
    whatToExpect: ["Please remove personal items before we arrive"],
    basePriceCents: 6900,
    baseDurationMin: 60,
    locationTypes: BOTH,
    sort: 2,
  },
  {
    slug: "interior-detail",
    category: "interior",
    kind: "service",
    name: "Interior detail",
    summary: "Vacuum, steam and shampoo — seats, carpets, plastics and glass.",
    descriptionMd:
      "Every surface inside is cleaned: thorough vacuum, steam on vents and cup holders, shampoo and extraction on carpets and cloth seats (or clean and condition for leather), and streak-free glass.",
    includes: ["Full vacuum including trunk", "Steam clean of vents, consoles and door pockets", "Carpet and upholstery shampoo/extraction", "Leather clean and condition", "Interior glass"],
    whatToExpect: ["Please remove personal items before we arrive", "Seats can take 2–4 hours to fully dry"],
    basePriceCents: 14900,
    baseDurationMin: 150,
    locationTypes: BOTH,
    sort: 2,
  },
  {
    slug: "full-detail",
    category: "interior",
    kind: "service",
    name: "Full detail",
    summary: "Our complete inside-and-out reset for daily drivers.",
    descriptionMd:
      "The interior detail and the exterior wash & wax together, plus clay-bar decontamination for paint that feels glass-smooth.",
    includes: ["Everything in Interior detail", "Everything in Exterior wash & wax", "Clay-bar decontamination"],
    whatToExpect: ["Plan on most of the day for larger vehicles"],
    basePriceCents: 24900,
    baseDurationMin: 240,
    locationTypes: BOTH,
    sort: 3,
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
    kind: "service",
    name: "Ceramic coating",
    summary: "Multi-year protection with extreme gloss and easy washing.",
    descriptionMd: "A professional-grade ceramic coating applied to decontaminated, polished paint. Repels water and dirt, resists UV and chemical etching, and makes washing far easier.",
    includes: ["Panel prep wipe", "Coating on paint, glass and wheel faces", "Cure inspection", "Care guide"],
    whatToExpect: ["Keep the car dry for 24 hours after application", "Requires paint decontamination (added automatically)"],
    basePriceCents: 59900,
    baseDurationMin: 300,
    locationTypes: ["shop"],
    sort: 13,
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
    basePriceCents: 7900,
    baseDurationMin: 60,
    locationTypes: BOTH,
    sort: 20,
  },
  {
    slug: "engine-bay",
    category: "exterior",
    kind: "addon",
    name: "Engine bay detail",
    summary: "Safe degrease, rinse and dress of the engine bay.",
    descriptionMd: "Electrical components are protected, then the bay is degreased, gently rinsed and dressed for a clean, factory look.",
    includes: ["Degrease", "Low-pressure rinse", "Plastic and rubber dressing"],
    whatToExpect: ["Engine must be cool"],
    basePriceCents: 5900,
    baseDurationMin: 45,
    locationTypes: BOTH,
    sort: 21,
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
    summary: "Specialist tools to lift embedded pet hair.",
    descriptionMd: "Rubber brushes and air tools to pull embedded hair from carpets and upholstery.",
    includes: ["Carpets and seats", "Cargo area"],
    whatToExpect: [],
    basePriceCents: 4900,
    baseDurationMin: 45,
    locationTypes: BOTH,
    sort: 23,
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

export const seedPackages = [
  {
    slug: "basic",
    name: "Basic",
    tier: 1,
    tagline: "A fresh, clean car inside and out.",
    basePriceCents: 14900,
    baseDurationMin: 150,
    featured: false,
    services: ["exterior-wash-wax", "interior-refresh"],
    sort: 1,
  },
  {
    slug: "premium",
    name: "Premium",
    tier: 2,
    tagline: "Our most popular full reset.",
    basePriceCents: 27900,
    baseDurationMin: 270,
    featured: true,
    services: ["exterior-wash-wax", "interior-detail", "paint-decontamination"],
    sort: 2,
  },
  {
    slug: "ultimate",
    name: "Ultimate",
    tier: 3,
    tagline: "Premium plus gloss-boosting polish and headlight restoration.",
    basePriceCents: 44900,
    baseDurationMin: 420,
    featured: false,
    services: ["exterior-wash-wax", "interior-detail", "paint-decontamination", "headlight-restoration", "engine-bay"],
    sort: 3,
  },
] as const;

export const seedRules = [
  {
    kind: "requires" as const,
    service: "ceramic-coating",
    target: "paint-decontamination",
    reason: "A coating only bonds to fully decontaminated paint, so decontamination is always done first.",
  },
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
    service: "full-detail",
    target: "interior-detail",
    reason: "The full detail already includes the interior detail.",
  },
  {
    kind: "excludes" as const,
    service: "full-detail",
    target: "exterior-wash-wax",
    reason: "The full detail already includes the exterior wash & wax.",
  },
  {
    kind: "excludes" as const,
    service: "interior-detail",
    target: "interior-refresh",
    reason: "The interior detail already covers everything in the refresh.",
  },
  {
    kind: "excludes" as const,
    service: "full-detail",
    target: "interior-refresh",
    reason: "The full detail already covers everything in the refresh.",
  },
  {
    kind: "excludes" as const,
    service: "paint-correction-1-stage",
    target: "paint-correction-2-stage",
    reason: "Choose one level of paint correction.",
  },
];

export const seedConditions = [
  { id: "light", group: "soil" as const, label: "Light — regular upkeep", description: "Washed in the last month, light dust.", surchargeType: "flat" as const, surchargeValue: 0, extraMinutes: 0, sort: 1 },
  { id: "moderate", group: "soil" as const, label: "Moderate — needs some love", description: "Crumbs, some stains, road film.", surchargeType: "flat" as const, surchargeValue: 2500, extraMinutes: 30, sort: 2 },
  { id: "heavy", group: "soil" as const, label: "Heavy — it's been a while", description: "Heavy soiling, mud, sand, spills.", surchargeType: "percent" as const, surchargeValue: 20, extraMinutes: 60, sort: 3 },
  { id: "pet_hair", group: "extra" as const, label: "Pet hair", description: "Noticeable pet hair in the cabin.", surchargeType: "flat" as const, surchargeValue: 3000, extraMinutes: 30, sort: 4 },
  { id: "stains", group: "extra" as const, label: "Stains", description: "Visible stains on seats or carpets.", surchargeType: "flat" as const, surchargeValue: 2500, extraMinutes: 30, sort: 5 },
] as const;
