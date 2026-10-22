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
  name: ph("Your Detailing Co.", "brand.name", "Trading name shown in the header, emails and SMS"),
  legalName: ph("Your Detailing Co. LLC", "brand.legalName", "Legal entity name for terms/privacy"),
  tagline: ph(
    "Showroom finish, wherever you park.",
    "brand.tagline",
    "One-line tagline under the logo / in meta descriptions",
  ),
  description: ph(
    "Premium mobile and in-shop car detailing: paint correction, ceramic coating, interior detailing and more. Book online in minutes.",
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
    brand: ph("#c8a24a", "brand.colors.brand", "Primary accent colour (hex)"),
    brandContrast: "#0b0c0e",
  },

  locale: "en-US",
  country: "US" as const,
  currency: "USD",
  timezone: ph("America/Chicago", "contact.timezone", "IANA time zone of the business"),

  contact: {
    /** E.164 — used for tel: links and Twilio. 555-01xx numbers are reserved as fictional. */
    phone: ph("+15550102030", "contact.phone", "Main phone number in E.164 (+1…)"),
    phoneDisplay: ph("(555) 010-2030", "contact.phoneDisplay", "Phone number as displayed"),
    sms: ph("+15550102030", "contact.sms", "Number customers can text (sms: link)"),
    email: ph("hello@example.com", "contact.email", "Public contact email"),
  },

  /** Physical shop. Set `enabled: false` for mobile-only businesses (address is then hidden in JSON-LD). */
  shop: {
    enabled: true,
    address: ph(
      {
        line1: "123 Example Street",
        line2: "Unit 4",
        city: "Example City",
        region: "TX",
        postalCode: "00010",
        country: "US",
      },
      "shop.address",
      "Shop street address (or set shop.enabled = false)",
    ),
    geo: ph({ lat: 39.0997, lng: -94.5786 }, "shop.geo", "Shop latitude/longitude"),
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
      "Not happy with any area? Tell us within 48 hours and we'll come back and make it right — free.",
      "proof.guarantee",
      "Your satisfaction guarantee wording",
    ),
  },

  flags: {
    memberships: false,
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
    /** ZIP lists and/or radius rings (km from settings.base). Fake ZIPs 000xx are deliberate. */
    zones: ph(
      [
        {
          name: "Core area",
          zipCodes: ["00010", "00011", "00012", "00013", "00014"],
          ringMaxKm: 15,
          travelFeeCents: 0,
          travelMinutes: 20,
          cities: ["Downtown", "Midtown"],
        },
        {
          name: "Extended area",
          zipCodes: ["00020", "00021", "00022"],
          ringMaxKm: 30,
          travelFeeCents: 2500,
          travelMinutes: 35,
          cities: ["Northside", "Lakeview"],
        },
        {
          name: "Outer area",
          zipCodes: ["00030", "00031"],
          ringMaxKm: 45,
          travelFeeCents: 4500,
          travelMinutes: 50,
          cities: ["Riverbend"],
        },
      ],
      "ops.zones",
      "Service zones: ZIP codes and/or radius, travel fee and travel minutes",
    ),
    settings: ph<OperationalSettings>(
      {
        timezone: "America/Chicago",
        serviceMode: "both",
        slotIntervalMin: 30,
        bufferMin: 30,
        minLeadHours: 18,
        maxDaysAhead: 60,
        holdMinutes: 10,
        holdExtensionMinutes: 5,
        holdMaxTotalMinutes: 25,
        paymentHoldMinutes: 15,
        travelCountsAgainstHours: false,
        base: { label: "Example City base", lat: 39.0997, lng: -94.5786 },
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
