/**
 * Business config — the single source of truth for brand, contact, links and flags,
 * plus the DEFAULT operational values that `db/seed.ts` copies into the database.
 *
 * After seeding, hours / blackouts / capacity / zones / deposit / policies are owned by
 * the admin dashboard (docs/PLAN.md §0). Editing the defaults below only affects a
 * fresh seed.
 *
 * Every value wrapped in `ph()` is a placeholder. `pnpm launch-check` fails until all
 * of them are replaced with real values. Placeholders that could be mistaken for real
 * claims (ratings, stats, certifications) are also rendered with a visible "Sample" tag.
 */
import type { BusinessHoursRow, OperationalSettings } from "@/lib/domain/settings";
import { ph } from "./placeholder";

export const business = {
  name: "MJDETAILZ",
  legalName: ph("MJDETAILZ", "brand.legalName", "Legal entity name for terms/privacy (add LLC/Inc. if registered)"),
  tagline: "More than just a clean. It's an elite detail.",
  description: ph(
    "Premium mobile car detailing in Houston, TX: maintenance washes, deep interior refreshes, full details and showroom finishes. Book online in minutes.",
    "brand.description",
    "Default meta description (≈155 characters)",
  ),
  /** Short code used in booking numbers, e.g. DS-7K3QX. */
  bookingPrefix: "DS",
  logo: {
    src: ph("/brand/logo.svg", "brand.logo", "SVG logo in /public/brand (light + dark friendly)"),
    width: 168,
    height: 32,
  },
  /** Brand colours become CSS variables (--brand, --brand-contrast). Must keep 4.5:1 on text. */
  colors: {
    brand: ph("#2b8cff", "brand.colors.brand", "Primary accent colour (hex)"),
    brandContrast: "#0b0c0e",
  },

  locale: "en-US",
  country: "US" as const,
  currency: "USD",
  timezone: ph("America/Chicago", "contact.timezone", "IANA time zone of the business"),

  contact: {
    /** E.164 — used for tel: links and Twilio. NXX-555-01xx numbers are reserved as fictional. */
    phone: "+18322507430",
    phoneDisplay: "(832) 250-7430",
    sms: "+18322507430",
    email: ph("hello@example.com", "contact.email", "Public contact email"),
  },

  /** Physical shop. Set `enabled: false` for mobile-only businesses (address is then hidden in JSON-LD). */
  shop: {
    // MJDETAILZ is 100% mobile for now. Set to true (or SHOP_ENABLED=1, used by the e2e suite) once
    // there's a shop, and set Service mode in Admin → Settings.
    enabled: process.env.SHOP_ENABLED === "1",
    address: ph(
      {
        line1: "123 Example Street",
        line2: "Unit 4",
        city: "Houston",
        region: "TX",
        postalCode: "77002",
        country: "US",
      },
      "shop.address",
      "Shop street address (or set shop.enabled = false)",
    ),
    geo: ph({ lat: 29.7604, lng: -95.3698 }, "shop.geo", "Shop latitude/longitude"),
    mapsUrl: ph(
      "https://maps.google.com/?q=123+Example+Street",
      "shop.mapsUrl",
      "Google Maps link to the shop",
    ),
  },

  links: {
    googleBusinessProfile: ph(
      "https://g.page/r/example",
      "links.gbp",
      "Google Business Profile URL",
    ),
    googleReviews: ph(
      "https://g.page/r/example/review",
      "links.reviews",
      "Direct 'leave a review' link (used in review-request messages)",
    ),
    instagram: ph("https://instagram.com/example", "links.instagram", "Instagram URL (or null)"),
    facebook: ph("https://facebook.com/example", "links.facebook", "Facebook URL (or null)"),
    tiktok: null as string | null,
    youtube: null as string | null,
  },

  /** Trust signals. Real numbers only — `isReal` gates AggregateRating JSON-LD. */
  proof: {
    rating: ph({ value: 4.9, count: 128, isReal: false }, "proof.rating", "Google rating + count"),
    carsDetailed: ph(1500, "proof.carsDetailed", "Number of cars detailed (real figure)"),
    yearsInBusiness: ph(6, "proof.years", "Years in business"),
    insured: ph(true, "proof.insured", "Confirm you carry liability insurance"),
    certifications: ph(
      ["Certified ceramic coating installer"],
      "proof.certifications",
      "Real certifications only",
    ),
    productsUsed: ph(
      ["Professional-grade ceramic coatings", "pH-neutral shampoos", "Steam extraction"],
      "proof.products",
      "Brands/products you actually use",
    ),
    guarantee: ph(
      "Satisfaction guaranteed — if something isn't right, tell us and we'll make it right.",
      "proof.guarantee",
      "Your satisfaction guarantee terms (the flyer only says 'Satisfaction guaranteed'; add any time limit)",
    ),
  },

  /** VIP maintenance membership (shown when flags.memberships is on). From the owner's price flyer. */
  membership: {
    name: "VIP Maintenance Membership",
    priceLabel: "$1,200 – $1,500",
    period: "per year",
    perks: [
      "Up to 4 maintenance details per month (1 per week)",
      "Priority scheduling",
      "Discounted add-on services",
      "Keeps your vehicles looking their best all year long",
    ],
  },

  flags: {
    memberships: true,
    giftCards: false,
    exitIntentOffer: false,
    googleCalendarSync: false,
  },

  giftCards: {
    /** Stripe Payment Link created in the Stripe dashboard (only used when flags.giftCards). */
    paymentLink: null as string | null,
  },

  exitOffer: {
    promoCode: "FIRSTDETAIL",
    headline: "First detail with us? Take 10% off.",
  },

  /** TCPA-style SMS consent wording. Bump `version` whenever the text changes. */
  smsConsent: {
    version: "2026-10-22",
    text: ph(
      "Text me appointment confirmations and reminders. By checking this box, I agree to receive automated text messages from {business} at the number provided. Consent is not a condition of purchase. Message frequency varies (about 2–4 per booking). Message and data rates may apply. Reply STOP to opt out or HELP for help.",
      "legal.smsConsent",
      "Have your SMS consent wording reviewed (TCPA)",
    ),
  },

  legal: {
    reviewedByCounsel: ph(false, "legal.reviewed", "Privacy, terms & cancellation pages reviewed by a lawyer"),
  },

  /** Defaults copied into the database by `pnpm db:seed`. */
  defaults: {
    hours: ph<BusinessHoursRow[]>(
      [
        { weekday: 1, opens: "08:00", closes: "18:00" },
        { weekday: 2, opens: "08:00", closes: "18:00" },
        { weekday: 3, opens: "08:00", closes: "18:00" },
        { weekday: 4, opens: "08:00", closes: "18:00" },
        { weekday: 5, opens: "08:00", closes: "18:00" },
        { weekday: 6, opens: "08:00", closes: "16:00" },
      ],
      "ops.hours",
      "Opening hours per weekday",
    ),
    blackoutDates: ph(
      [
        { date: "2026-11-26", reason: "Thanksgiving" },
        { date: "2026-12-25", reason: "Christmas Day" },
        { date: "2027-01-01", reason: "New Year's Day" },
      ],
      "ops.blackouts",
      "Holidays / closed dates",
    ),
    resources: ph(
      [
        { name: "Mobile crew 1", type: "mobile_crew" as const, color: "#c8a24a" },
        { name: "Mobile crew 2", type: "mobile_crew" as const, color: "#5b8def" },
        { name: "Shop bay 1", type: "shop_bay" as const, color: "#3fb68b" },
      ],
      "ops.resources",
      "How many mobile crews and shop bays can work at the same time",
    ),
    /** ZIP lists and/or radius rings (km from settings.base). Travel fees and ZIP lists are starting guesses. */
    zones: ph(
      [
        {
          name: "Houston",
          // Houston proper: 77001–77099.
          zipCodes: Array.from({ length: 99 }, (_, i) => String(77001 + i)),
          ringMaxKm: 25,
          travelFeeCents: 0,
          travelMinutes: 20,
          cities: ["Houston"],
        },
        {
          name: "Surrounding areas",
          zipCodes: [
            "77449", "77450", "77493", "77494", // Katy
            "77478", "77479", "77498", // Sugar Land
            "77459", "77489", // Missouri City
            "77581", "77584", // Pearland
            "77373", "77379", "77388", "77389", // Spring
            "77429", "77433", // Cypress
            "77338", "77346", // Humble
            "77502", "77503", "77504", "77505", // Pasadena
          ],
          ringMaxKm: 45,
          travelFeeCents: 0,
          travelMinutes: 35,
          cities: ["Katy", "Sugar Land", "Missouri City", "Pearland", "Spring", "Cypress", "Humble", "Pasadena"],
        },
        {
          name: "Outer areas",
          zipCodes: ["77380", "77381", "77382", "77384", "77385", "77386", "77301", "77302", "77303", "77304", "77573", "77375", "77377", "77520", "77521", "77546"],
          ringMaxKm: 70,
          travelFeeCents: 0,
          travelMinutes: 50,
          cities: ["The Woodlands", "Conroe", "League City", "Tomball", "Baytown", "Friendswood"],
        },
      ],
      "ops.zones",
      "Service zones: ZIP codes and/or radius, travel fee and travel minutes",
    ),
    settings: ph<OperationalSettings>(
      {
        timezone: "America/Chicago",
        serviceMode: "mobile",
        slotIntervalMin: 30,
        bufferMin: 30,
        minLeadHours: 18,
        maxDaysAhead: 60,
        holdMinutes: 10,
        holdExtensionMinutes: 5,
        holdMaxTotalMinutes: 25,
        paymentHoldMinutes: 15,
        travelCountsAgainstHours: false,
        base: { label: "Houston base", lat: 29.7604, lng: -95.3698 },
        deposit: { mode: "fixed", valueCents: 5000 },
        cancellation: { windowHours: 24, lateFee: { type: "forfeit_deposit" } },
        reschedule: { minHoursBefore: 24, maxCount: 2 },
        taxRateBps: 0,
        taxTravel: false,
        priceRoundingCents: 100,
        reminders: {
          hoursBefore: [24, 2],
          reviewDelayHours: 2,
          smsQuietStart: "21:00",
          smsQuietEnd: "08:00",
        },
        quoteValidityDays: 14,
        leadRetentionMonths: 12,
        catalogReviewed: false,
      },
      "ops.settings",
      "Deposit, cancellation window/fee, reschedule rules, lead time, tax rate, base location",
    ),
  },
} as const;

export type Business = typeof business;
