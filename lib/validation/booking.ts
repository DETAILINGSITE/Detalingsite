/**
 * Shared client + server schemas for the booking flow. The wizard validates each
 * step with these before advancing, and every Server Action re-validates the raw
 * input with the same schemas.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

export const LOCATION_TYPES = ["mobile", "shop"] as const;
export const CONTACT_METHODS = ["email", "sms", "call"] as const;
export const HEARD_ABOUT = [
  "google",
  "maps",
  "instagram",
  "facebook",
  "tiktok",
  "friend",
  "repeat",
  "drove_by",
  "other",
] as const;
export const HEARD_ABOUT_LABELS: Record<(typeof HEARD_ABOUT)[number], string> = {
  google: "Google search",
  maps: "Google Maps",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  friend: "Friend or family",
  repeat: "I'm a returning customer",
  drove_by: "Saw your van or shop",
  other: "Other",
};
export const BUDGET_RANGES = ["under_250", "250_500", "500_1000", "1000_2500", "over_2500"] as const;
export const BUDGET_LABELS: Record<(typeof BUDGET_RANGES)[number], string> = {
  under_250: "Under $250",
  "250_500": "$250–$500",
  "500_1000": "$500–$1,000",
  "1000_2500": "$1,000–$2,500",
  over_2500: "Over $2,500",
};

const id = z.string().trim().min(1).max(64);
const optionalText = (max: number) => z.string().trim().max(max).optional();

/** Accepts anything a person might type; outputs E.164. */
export const PhoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your phone number")
  .max(32, "That phone number is too long")
  .transform((value, ctx) => {
    const parsed = parsePhoneNumberFromString(value, "US");
    if (!parsed || !parsed.isValid()) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. (555) 010-2030" });
      return z.NEVER;
    }
    return parsed.number;
  });

export function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164, "US");
  return parsed ? parsed.formatNational() : e164;
}

export const EmailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .max(254)
  .pipe(z.email("Enter a valid email address, e.g. name@example.com"));

// ── Step 2: vehicle ───────────────────────────────────────────────────────────
const currentYear = new Date().getUTCFullYear();
export const VehicleSchema = z.object({
  sizeId: z.string().min(1, "Choose your vehicle size"),
  year: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}$/.test(v) && +v >= 1950 && +v <= currentYear + 1), {
      message: `Enter a year between 1950 and ${currentYear + 1}`,
    })
    .optional(),
  make: optionalText(40),
  model: optionalText(60),
  color: optionalText(30),
  conditionIds: z.array(id).max(10),
});
export type VehicleInput = z.input<typeof VehicleSchema>;

// ── Step 3: services ──────────────────────────────────────────────────────────
export const ServicesSchema = z
  .object({
    packageId: id.nullable(),
    serviceIds: z.array(id).max(20),
    addonIds: z.array(id).max(20),
  })
  .refine((v) => v.packageId !== null || v.serviceIds.length > 0, {
    message: "Choose a package or at least one service",
    path: ["serviceIds"],
  });
export type ServicesInput = z.input<typeof ServicesSchema>;

// ── Step 3B: custom job ───────────────────────────────────────────────────────
export const CustomJobSchema = z.object({
  description: z
    .string()
    .trim()
    .min(20, "Tell us a bit more — at least 20 characters")
    .max(2000, "Please keep it under 2,000 characters"),
  photoIds: z.array(z.uuid()).max(10, "You can upload up to 10 photos"),
  preferredDates: z.array(z.iso.date()).max(5, "Pick up to 5 dates"),
  budgetRange: z.enum(BUDGET_RANGES).optional(),
  serviceIds: z.array(id).max(20),
});
export type CustomJobInput = z.input<typeof CustomJobSchema>;

// ── Step 4: location ──────────────────────────────────────────────────────────
export const AddressSchema = z.object({
  line1: z.string().trim().min(3, "Enter the street address").max(120),
  line2: optionalText(60),
  city: z.string().trim().min(2, "Enter the city").max(60),
  region: z.string().trim().min(2, "Enter the state").max(40),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code"),
  country: z.literal("US"),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  placeId: optionalText(300),
});
export type AddressInput = z.input<typeof AddressSchema>;

export const LocationSchema = z.discriminatedUnion("locationType", [
  z.object({
    locationType: z.literal("mobile"),
    address: AddressSchema,
    accessNotes: optionalText(500),
    hasWater: z.boolean(),
    hasPower: z.boolean(),
  }),
  z.object({ locationType: z.literal("shop") }),
]);
export type LocationInput = z.input<typeof LocationSchema>;

// ── Step 5: schedule ──────────────────────────────────────────────────────────
export const ScheduleSchema = z.object({
  slotStart: z.iso.datetime({ offset: true, error: "Choose a time" }),
});

// ── Step 6: contact ───────────────────────────────────────────────────────────
export const ContactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  phone: PhoneSchema,
  email: EmailSchema,
  preferredContact: z.enum(CONTACT_METHODS, "Choose how we should contact you"),
  smsConsent: z.boolean(),
  leadConsent: z.boolean(),
  heardAbout: z.enum(HEARD_ABOUT).optional(),
  /** Honeypot — real users never fill this. */
  website: z.string().max(0, "Please leave this field empty").optional(),
});
export type ContactInput = z.input<typeof ContactSchema>;
export type ContactData = z.output<typeof ContactSchema>;

// ── Step 7: review ────────────────────────────────────────────────────────────
export const ReviewSchema = z.object({
  agreePolicy: z.literal(true, "Please agree to the cancellation policy to continue"),
  promoCode: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9_-]*$/, "Promo codes use letters and numbers only")
    .optional(),
});

// ── Shared composite pieces used by Server Actions ────────────────────────────
export const SelectionSchema = z.object({
  sizeId: z.string().min(1),
  packageId: id.nullable(),
  serviceIds: z.array(id).max(20),
  addonIds: z.array(id).max(20),
  conditionIds: z.array(id).max(10),
});
export type SelectionInput = z.infer<typeof SelectionSchema>;

export const AttributionSchema = z.object({
  utmSource: optionalText(200),
  utmMedium: optionalText(200),
  utmCampaign: optionalText(200),
  utmTerm: optionalText(200),
  utmContent: optionalText(200),
  referrer: optionalText(500),
  landingPath: optionalText(500),
  firstSeenAt: z.iso.datetime({ offset: true }).optional(),
});
export type Attribution = z.infer<typeof AttributionSchema>;

export const VehicleDetailsSchema = VehicleSchema.omit({ sizeId: true, conditionIds: true });
