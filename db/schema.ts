/**
 * Drizzle mapping of db/migrations/*.sql. The SQL files are the source of truth
 * (they contain the exclusion constraint and partial indexes Drizzle can't express);
 * tests/integration/schema-parity.test.ts checks every column here exists in the DB.
 */
import {
  bigserial,
  boolean,
  customType,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { OperationalSettings } from "@/lib/domain/settings";
import type { PriceResult } from "@/lib/domain/pricing";
import type { Attribution, SelectionInput } from "@/lib/validation/booking";

// ─── Custom column types ─────────────────────────────────────────────────────
export const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const inet = customType<{ data: string }>({
  dataType: () => "inet",
});

export interface TimeRange {
  start: Date;
  end: Date;
}

/** Half-open [start, end) timestamptz range. */
export const tstzrange = customType<{ data: TimeRange; driverData: string }>({
  dataType: () => "tstzrange",
  toDriver: (v) => `[${v.start.toISOString()},${v.end.toISOString()})`,
  fromDriver: (raw) => parseTstzRange(raw),
});

export function parseTstzRange(raw: string): TimeRange {
  const m = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/.exec(raw.trim());
  if (!m?.[1] || !m[2]) throw new Error(`Unparseable tstzrange: ${raw}`);
  return { start: new Date(m[1]), end: new Date(m[2]) };
}

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// ─── Enums ───────────────────────────────────────────────────────────────────
export const locationType = pgEnum("location_type", ["mobile", "shop"]);
export const serviceKind = pgEnum("service_kind", ["service", "addon"]);
export const ruleKind = pgEnum("rule_kind", ["requires", "excludes"]);
export const conditionGroup = pgEnum("condition_group", ["soil", "extra"]);
export const surchargeType = pgEnum("surcharge_type", ["flat", "percent"]);
export const promoKind = pgEnum("promo_kind", ["percent", "fixed"]);
export const resourceType = pgEnum("resource_type", ["mobile_crew", "shop_bay"]);
export const allocationKind = pgEnum("allocation_kind", ["booking", "block"]);
export const contactMethod = pgEnum("contact_method", ["email", "sms", "call"]);
export const bookingStatus = pgEnum("booking_status", [
  "held",
  "pending_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "expired",
]);
export const bookingSource = pgEnum("booking_source", ["web", "admin", "quote"]);
export const eventActor = pgEnum("event_actor", ["customer", "admin", "system", "stripe"]);
export const paymentKind = pgEnum("payment_kind", ["deposit", "balance", "refund"]);
export const paymentMethod = pgEnum("payment_method", ["stripe", "cash", "card_terminal", "other"]);
export const paymentStatus = pgEnum("payment_status", [
  "open",
  "succeeded",
  "failed",
  "expired",
  "refunded",
  "partially_refunded",
  "cancelled",
]);
export const webhookProvider = pgEnum("webhook_provider", ["stripe", "twilio"]);
export const quoteStatus = pgEnum("quote_status", ["new", "quoted", "accepted", "declined", "expired"]);
export const photoStatus = pgEnum("photo_status", ["pending", "uploaded", "attached", "rejected"]);
export const leadSource = pgEnum("lead_source", [
  "booking_abandoned",
  "contact_form",
  "quote",
  "exit_offer",
  "admin",
]);
export const leadStatus = pgEnum("lead_status", ["new", "contacted", "won", "lost", "spam"]);
export const reviewSource = pgEnum("review_source", ["google", "yelp", "facebook", "direct"]);
export const outboxStatus = pgEnum("outbox_status", [
  "pending",
  "running",
  "done",
  "failed",
  "cancelled",
  "skipped",
]);
export const adminRole = pgEnum("admin_role", ["owner", "staff"]);

// ─── Catalog ─────────────────────────────────────────────────────────────────
export const vehicleSizes = pgTable("vehicle_sizes", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  priceMultiplier: numeric("price_multiplier", { precision: 4, scale: 2, mode: "number" }).notNull(),
  durationMultiplier: numeric("duration_multiplier", { precision: 4, scale: 2, mode: "number" }).notNull(),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  storageKey: text("storage_key").notNull().unique(),
  url: text("url").notNull(),
  contentType: text("content_type").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  blurDataUrl: text("blur_data_url"),
  alt: text("alt").notNull().default(""),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: citext("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: citext("slug").notNull().unique(),
  categoryId: uuid("category_id").references(() => serviceCategories.id, { onDelete: "set null" }),
  kind: serviceKind("kind").notNull().default("service"),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  descriptionMd: text("description_md").notNull().default(""),
  includes: text("includes").array().notNull().default([]),
  whatToExpect: text("what_to_expect").array().notNull().default([]),
  basePriceCents: integer("base_price_cents").notNull(),
  baseDurationMin: integer("base_duration_min").notNull(),
  quoteOnly: boolean("quote_only").notNull().default(false),
  locationTypes: locationType("location_types").array().notNull(),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  heroMediaId: uuid("hero_media_id").references(() => media.id, { onDelete: "set null" }),
  isPlaceholder: boolean("is_placeholder").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const serviceSizePrices = pgTable(
  "service_size_prices",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    sizeId: text("size_id")
      .notNull()
      .references(() => vehicleSizes.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents"),
    durationMin: integer("duration_min"),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.sizeId] })],
);

export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: citext("slug").notNull().unique(),
  name: text("name").notNull(),
  tier: smallint("tier").notNull().default(1),
  tagline: text("tagline").notNull().default(""),
  basePriceCents: integer("base_price_cents").notNull(),
  baseDurationMin: integer("base_duration_min").notNull(),
  featured: boolean("featured").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  isPlaceholder: boolean("is_placeholder").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const packageItems = pgTable(
  "package_items",
  {
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.packageId, t.serviceId] })],
);

export const packageSizePrices = pgTable(
  "package_size_prices",
  {
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    sizeId: text("size_id")
      .notNull()
      .references(() => vehicleSizes.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents"),
    durationMin: integer("duration_min"),
  },
  (t) => [primaryKey({ columns: [t.packageId, t.sizeId] })],
);

export const serviceRules = pgTable("service_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: ruleKind("kind").notNull(),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  targetServiceId: uuid("target_service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export const conditions = pgTable("conditions", {
  id: text("id").primaryKey(),
  group: conditionGroup("group").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  surchargeType: surchargeType("surcharge_type").notNull().default("flat"),
  surchargeValue: integer("surcharge_value").notNull().default(0),
  extraMinutes: integer("extra_minutes").notNull().default(0),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: citext("code").notNull().unique(),
  kind: promoKind("kind").notNull(),
  value: integer("value").notNull(),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  maxRedemptions: integer("max_redemptions"),
  redemptionCount: integer("redemption_count").notNull().default(0),
  firstBookingOnly: boolean("first_booking_only").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Scheduling ──────────────────────────────────────────────────────────────
export const settings = pgTable("settings", {
  id: smallint("id").primaryKey(),
  data: jsonb("data").$type<OperationalSettings>().notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: updatedAt(),
  updatedBy: text("updated_by"),
});

export const businessHours = pgTable("business_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekday: smallint("weekday").notNull(),
  opens: time("opens").notNull(),
  closes: time("closes").notNull(),
});

export const blackoutDates = pgTable("blackout_dates", {
  date: date("date", { mode: "string" }).primaryKey(),
  reason: text("reason").notNull().default(""),
});

export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: resourceType("type").notNull(),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  color: text("color").notNull().default("#888888"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const serviceZones = pgTable("service_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  zipCodes: text("zip_codes").array().notNull().default([]),
  ringMaxKm: numeric("ring_max_km", { precision: 6, scale: 2, mode: "number" }),
  travelFeeCents: integer("travel_fee_cents").notNull().default(0),
  travelMinutes: integer("travel_minutes").notNull().default(0),
  cities: text("cities").array().notNull().default([]),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Customers / quotes / bookings ───────────────────────────────────────────
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: citext("email"),
  phoneE164: text("phone_e164"),
  preferredContact: contactMethod("preferred_contact").notNull().default("email"),
  smsConsentAt: ts("sms_consent_at"),
  smsConsentTextVersion: text("sms_consent_text_version"),
  smsConsentIp: inet("sms_consent_ip"),
  smsOptOutAt: ts("sms_opt_out_at"),
  marketingConsentAt: ts("marketing_consent_at"),
  notes: text("notes").notNull().default(""),
  anonymizedAt: ts("anonymized_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export interface AddressJson {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

export const quoteRequests = pgTable("quote_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  submissionId: uuid("submission_id").notNull().unique(),
  status: quoteStatus("status").notNull().default("new"),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  vehicleSizeId: text("vehicle_size_id").references(() => vehicleSizes.id),
  vehicleYear: smallint("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleColor: text("vehicle_color"),
  description: text("description").notNull(),
  serviceIds: uuid("service_ids").array().notNull().default([]),
  preferredDates: date("preferred_dates", { mode: "string" }).array().notNull().default([]),
  budgetRange: text("budget_range"),
  locationType: locationType("location_type").notNull(),
  address: jsonb("address").$type<AddressJson | null>(),
  zoneId: uuid("zone_id").references(() => serviceZones.id, { onDelete: "set null" }),
  outOfArea: boolean("out_of_area").notNull().default(false),
  attribution: jsonb("attribution").$type<Attribution>().notNull().default({}),
  quotedPriceCents: integer("quoted_price_cents"),
  quotedDurationMin: integer("quoted_duration_min"),
  quotedDepositCents: integer("quoted_deposit_cents"),
  quoteMessage: text("quote_message"),
  quoteTokenHash: bytea("quote_token_hash").unique(),
  quoteTokenVersion: smallint("quote_token_version").notNull().default(0),
  quoteExpiresAt: ts("quote_expires_at"),
  quotedAt: ts("quoted_at"),
  quotedBy: text("quoted_by"),
  respondedAt: ts("responded_at"),
  declineReason: text("decline_reason"),
  bookingId: uuid("booking_id").unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export interface PriceSnapshot extends PriceResult {
  sizeLabel: string;
  computedAt: string;
}

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  status: bookingStatus("status").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  quoteRequestId: uuid("quote_request_id").references(() => quoteRequests.id),
  source: bookingSource("source").notNull().default("web"),
  locationType: locationType("location_type").notNull(),
  address: jsonb("address").$type<AddressJson | null>(),
  accessNotes: text("access_notes"),
  zoneId: uuid("zone_id").references(() => serviceZones.id, { onDelete: "set null" }),
  vehicleSizeId: text("vehicle_size_id")
    .notNull()
    .references(() => vehicleSizes.id),
  vehicleYear: smallint("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleColor: text("vehicle_color"),
  conditionIds: text("condition_ids").array().notNull().default([]),
  selection: jsonb("selection").$type<SelectionInput>().notNull(),
  priceSnapshot: jsonb("price_snapshot").$type<PriceSnapshot>().notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  surchargeCents: integer("surcharge_cents").notNull().default(0),
  travelFeeCents: integer("travel_fee_cents").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  depositCents: integer("deposit_cents").notNull(),
  balancePaidCents: integer("balance_paid_cents").notNull().default(0),
  promoCodeId: uuid("promo_code_id").references(() => promoCodes.id),
  durationMin: integer("duration_min").notNull(),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  timezone: text("timezone").notNull(),
  manageTokenHash: bytea("manage_token_hash").unique(),
  manageTokenVersion: smallint("manage_token_version").notNull().default(1),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  holdExtensions: smallint("hold_extensions").notNull().default(0),
  rescheduleCount: smallint("reschedule_count").notNull().default(0),
  cancelledAt: ts("cancelled_at"),
  cancelledBy: eventActor("cancelled_by"),
  cancelReason: text("cancel_reason"),
  cancellationFeeCents: integer("cancellation_fee_cents"),
  feeOwedCents: integer("fee_owed_cents").notNull().default(0),
  refundCents: integer("refund_cents"),
  attribution: jsonb("attribution").$type<Attribution>().notNull().default({}),
  heardAbout: text("heard_about"),
  leadConsentAt: ts("lead_consent_at"),
  internalNotes: text("internal_notes").notNull().default(""),
  confirmedAt: ts("confirmed_at"),
  completedAt: ts("completed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const resourceAllocations = pgTable("resource_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id")
    .notNull()
    .references(() => resources.id),
  kind: allocationKind("kind").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  period: tstzrange("period").notNull(),
  active: boolean("active").notNull().default(true),
  holdExpiresAt: ts("hold_expires_at"),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const bookingEvents = pgTable("booking_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  fromStatus: bookingStatus("from_status"),
  toStatus: bookingStatus("to_status"),
  actor: eventActor("actor").notNull(),
  actorId: text("actor_id"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  kind: paymentKind("kind").notNull(),
  method: paymentMethod("method").notNull().default("stripe"),
  amountCents: integer("amount_cents").notNull(),
  status: paymentStatus("status").notNull().default("open"),
  attempt: smallint("attempt").notNull().default(1),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeRefundId: text("stripe_refund_id").unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: webhookProvider("provider").notNull(),
  type: text("type").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
  error: text("error"),
});

export const quotePhotos = pgTable("quote_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploadSessionId: uuid("upload_session_id").notNull(),
  quoteRequestId: uuid("quote_request_id").references(() => quoteRequests.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  status: photoStatus("status").notNull().default("pending"),
  createdAt: createdAt(),
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").unique(),
  source: leadSource("source").notNull(),
  status: leadStatus("status").notNull().default("new"),
  name: text("name"),
  email: citext("email"),
  phoneE164: text("phone_e164"),
  message: text("message"),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  bookingId: uuid("booking_id")
    .unique()
    .references(() => bookings.id, { onDelete: "set null" }),
  quoteRequestId: uuid("quote_request_id").references(() => quoteRequests.id, { onDelete: "set null" }),
  consentContactAt: ts("consent_contact_at"),
  attribution: jsonb("attribution").$type<Attribution>().notNull().default({}),
  notes: text("notes").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Content ─────────────────────────────────────────────────────────────────
export const testimonials = pgTable("testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorName: text("author_name").notNull(),
  vehicle: text("vehicle"),
  rating: smallint("rating").notNull(),
  body: text("body").notNull(),
  source: reviewSource("source").notNull().default("google"),
  sourceUrl: text("source_url"),
  reviewDate: date("review_date", { mode: "string" }),
  isPlaceholder: boolean("is_placeholder").notNull().default(true),
  published: boolean("published").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const galleryItems = pgTable("gallery_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  vehicle: text("vehicle"),
  beforeSrc: text("before_src").notNull(),
  afterSrc: text("after_src").notNull(),
  width: integer("width").notNull().default(1600),
  height: integer("height").notNull().default(1067),
  altBefore: text("alt_before").notNull(),
  altAfter: text("alt_after").notNull(),
  isPlaceholder: boolean("is_placeholder").notNull().default(true),
  published: boolean("published").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const faqs = pgTable("faqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  answerMd: text("answer_md").notNull(),
  category: text("category").notNull().default("General"),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }),
  sort: integer("sort").notNull().default(0),
  published: boolean("published").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cityPages = pgTable("city_pages", {
  slug: citext("slug").primaryKey(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  zoneId: uuid("zone_id").references(() => serviceZones.id, { onDelete: "set null" }),
  introMd: text("intro_md").notNull(),
  localNotesMd: text("local_notes_md").notNull().default(""),
  published: boolean("published").notNull().default(true),
  isPlaceholder: boolean("is_placeholder").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Operations ──────────────────────────────────────────────────────────────
export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  runAt: ts("run_at").notNull(),
  status: outboxStatus("status").notNull().default("pending"),
  attempts: smallint("attempts").notNull().default(0),
  maxAttempts: smallint("max_attempts").notNull().default(6),
  lastError: text("last_error"),
  dedupeKey: text("dedupe_key").notNull().unique(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  quoteRequestId: uuid("quote_request_id").references(() => quoteRequests.id, { onDelete: "cascade" }),
  lockedUntil: ts("locked_until"),
  providerId: text("provider_id"),
  createdAt: createdAt(),
  doneAt: ts("done_at"),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const funnelEvents = pgTable("funnel_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sessionId: uuid("session_id").notNull(),
  event: text("event").notNull(),
  step: text("step"),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  utmSource: text("utm_source"),
  at: ts("at").notNull().defaultNow(),
});

export const cronRuns = pgTable("cron_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  startedAt: ts("started_at").notNull(),
  finishedAt: ts("finished_at"),
  processed: integer("processed").notNull().default(0),
  error: text("error"),
});

// ─── Admin auth (Better Auth) ────────────────────────────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: adminRole("role").notNull().default("staff"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: ts("locked_until"),
});

export const adminAuditLog = pgTable("admin_audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  diff: jsonb("diff").$type<Record<string, unknown>>().notNull().default({}),
  at: ts("at").notNull().defaultNow(),
});

export const authSchema = { user, session, account, verification, twoFactor };
