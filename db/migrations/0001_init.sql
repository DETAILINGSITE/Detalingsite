-- 0001_init — full schema (docs/PLAN.md §3).
-- Hand-written so the exclusion constraint, partial indexes and extensions are explicit.
-- Applied by scripts/db/migrate.ts inside a single transaction.

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- lets uuid "=" and tstzrange "&&" share one GiST exclusion constraint
CREATE EXTENSION IF NOT EXISTS citext;

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE location_type      AS ENUM ('mobile', 'shop');
CREATE TYPE service_kind       AS ENUM ('service', 'addon');
CREATE TYPE rule_kind          AS ENUM ('requires', 'excludes');
CREATE TYPE condition_group    AS ENUM ('soil', 'extra');
CREATE TYPE surcharge_type     AS ENUM ('flat', 'percent');
CREATE TYPE promo_kind         AS ENUM ('percent', 'fixed');
CREATE TYPE resource_type      AS ENUM ('mobile_crew', 'shop_bay');
CREATE TYPE allocation_kind    AS ENUM ('booking', 'block');
CREATE TYPE contact_method     AS ENUM ('email', 'sms', 'call');
CREATE TYPE booking_status     AS ENUM ('held', 'pending_payment', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'expired');
CREATE TYPE booking_source     AS ENUM ('web', 'admin', 'quote');
CREATE TYPE event_actor        AS ENUM ('customer', 'admin', 'system', 'stripe');
CREATE TYPE payment_kind       AS ENUM ('deposit', 'balance', 'refund');
CREATE TYPE payment_method     AS ENUM ('stripe', 'cash', 'card_terminal', 'other');
CREATE TYPE payment_status     AS ENUM ('open', 'succeeded', 'failed', 'expired', 'refunded', 'partially_refunded', 'cancelled');
CREATE TYPE webhook_provider   AS ENUM ('stripe', 'twilio');
CREATE TYPE quote_status       AS ENUM ('new', 'quoted', 'accepted', 'declined', 'expired');
CREATE TYPE photo_status       AS ENUM ('pending', 'uploaded', 'attached', 'rejected');
CREATE TYPE lead_source        AS ENUM ('booking_abandoned', 'contact_form', 'quote', 'exit_offer', 'admin');
CREATE TYPE lead_status        AS ENUM ('new', 'contacted', 'won', 'lost', 'spam');
CREATE TYPE review_source      AS ENUM ('google', 'yelp', 'facebook', 'direct');
CREATE TYPE outbox_status      AS ENUM ('pending', 'running', 'done', 'failed', 'cancelled', 'skipped');
CREATE TYPE admin_role         AS ENUM ('owner', 'staff');

-- ─── Catalog ─────────────────────────────────────────────────────────────────
CREATE TABLE vehicle_sizes (
  id                  text PRIMARY KEY,
  label               text NOT NULL,
  description         text NOT NULL DEFAULT '',
  price_multiplier    numeric(4,2) NOT NULL CHECK (price_multiplier > 0),
  duration_multiplier numeric(4,2) NOT NULL CHECK (duration_multiplier > 0),
  sort                integer NOT NULL DEFAULT 0,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key   text NOT NULL UNIQUE,
  url           text NOT NULL,
  content_type  text NOT NULL,
  width         integer NOT NULL CHECK (width > 0),
  height        integer NOT NULL CHECK (height > 0),
  blur_data_url text,
  alt           text NOT NULL DEFAULT '',
  size_bytes    integer NOT NULL CHECK (size_bytes >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        citext NOT NULL UNIQUE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              citext NOT NULL UNIQUE,
  category_id       uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  kind              service_kind NOT NULL DEFAULT 'service',
  name              text NOT NULL,
  summary           text NOT NULL DEFAULT '',
  description_md    text NOT NULL DEFAULT '',
  includes          text[] NOT NULL DEFAULT '{}',
  what_to_expect    text[] NOT NULL DEFAULT '{}',
  base_price_cents  integer NOT NULL CHECK (base_price_cents >= 0),
  base_duration_min integer NOT NULL CHECK (base_duration_min > 0),
  quote_only        boolean NOT NULL DEFAULT false,
  location_types    location_type[] NOT NULL DEFAULT '{mobile,shop}',
  active            boolean NOT NULL DEFAULT true,
  sort              integer NOT NULL DEFAULT 0,
  seo_title         text,
  seo_description   text,
  hero_media_id     uuid REFERENCES media(id) ON DELETE SET NULL,
  is_placeholder    boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX services_category_sort_idx ON services (category_id, sort) WHERE active;

CREATE TABLE service_size_prices (
  service_id   uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  size_id      text NOT NULL REFERENCES vehicle_sizes(id) ON DELETE CASCADE,
  price_cents  integer CHECK (price_cents >= 0),
  duration_min integer CHECK (duration_min > 0),
  PRIMARY KEY (service_id, size_id)
);

CREATE TABLE packages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              citext NOT NULL UNIQUE,
  name              text NOT NULL,
  tier              smallint NOT NULL DEFAULT 1,
  tagline           text NOT NULL DEFAULT '',
  base_price_cents  integer NOT NULL CHECK (base_price_cents >= 0),
  base_duration_min integer NOT NULL CHECK (base_duration_min > 0),
  featured          boolean NOT NULL DEFAULT false,
  active            boolean NOT NULL DEFAULT true,
  sort              integer NOT NULL DEFAULT 0,
  is_placeholder    boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE package_items (
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  PRIMARY KEY (package_id, service_id)
);

CREATE TABLE package_size_prices (
  package_id   uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  size_id      text NOT NULL REFERENCES vehicle_sizes(id) ON DELETE CASCADE,
  price_cents  integer CHECK (price_cents >= 0),
  duration_min integer CHECK (duration_min > 0),
  PRIMARY KEY (package_id, size_id)
);

CREATE TABLE service_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              rule_kind NOT NULL,
  service_id        uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  target_service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  reason            text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, service_id, target_service_id),
  CHECK (service_id <> target_service_id)
);

CREATE TABLE conditions (
  id              text PRIMARY KEY,
  "group"         condition_group NOT NULL,
  label           text NOT NULL,
  description     text NOT NULL DEFAULT '',
  surcharge_type  surcharge_type NOT NULL DEFAULT 'flat',
  surcharge_value integer NOT NULL DEFAULT 0 CHECK (surcharge_value >= 0),
  extra_minutes   integer NOT NULL DEFAULT 0 CHECK (extra_minutes >= 0),
  sort            integer NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true
);

CREATE TABLE promo_codes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               citext NOT NULL UNIQUE,
  kind               promo_kind NOT NULL,
  value              integer NOT NULL CHECK (value > 0),
  starts_at          timestamptz,
  ends_at            timestamptz,
  max_redemptions    integer CHECK (max_redemptions > 0),
  redemption_count   integer NOT NULL DEFAULT 0,
  first_booking_only boolean NOT NULL DEFAULT false,
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'percent' OR value <= 100)
);

-- ─── Scheduling ──────────────────────────────────────────────────────────────
CREATE TABLE settings (
  id         smallint PRIMARY KEY CHECK (id = 1),
  data       jsonb NOT NULL,
  version    integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE business_hours (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),  -- ISO: 1 = Monday
  opens   time NOT NULL,
  closes  time NOT NULL,
  CHECK (opens < closes),
  UNIQUE (weekday, opens)
);

CREATE TABLE blackout_dates (
  date   date PRIMARY KEY,
  reason text NOT NULL DEFAULT ''
);

CREATE TABLE resources (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  type       resource_type NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  sort       integer NOT NULL DEFAULT 0,
  color      text NOT NULL DEFAULT '#888888',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_zones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  zip_codes        text[] NOT NULL DEFAULT '{}',
  ring_max_km      numeric(6,2) CHECK (ring_max_km > 0),
  travel_fee_cents integer NOT NULL DEFAULT 0 CHECK (travel_fee_cents >= 0),
  travel_minutes   integer NOT NULL DEFAULT 0 CHECK (travel_minutes >= 0),
  cities           text[] NOT NULL DEFAULT '{}',
  sort             integer NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_zones_zip_idx ON service_zones USING gin (zip_codes);

-- ─── Customers ───────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  email                    citext,
  phone_e164               text,
  preferred_contact        contact_method NOT NULL DEFAULT 'email',
  sms_consent_at           timestamptz,
  sms_consent_text_version text,
  sms_consent_ip           inet,
  sms_opt_out_at           timestamptz,
  marketing_consent_at     timestamptz,
  notes                    text NOT NULL DEFAULT '',
  anonymized_at            timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_email_uq ON customers (email) WHERE anonymized_at IS NULL;
CREATE INDEX customers_phone_idx ON customers (phone_e164);

-- ─── Quotes (FK to bookings added below) ─────────────────────────────────────
CREATE TABLE quote_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number               text NOT NULL UNIQUE,
  submission_id        uuid NOT NULL UNIQUE,
  status               quote_status NOT NULL DEFAULT 'new',
  customer_id          uuid NOT NULL REFERENCES customers(id),
  vehicle_size_id      text REFERENCES vehicle_sizes(id),
  vehicle_year         smallint,
  vehicle_make         text,
  vehicle_model        text,
  vehicle_color        text,
  description          text NOT NULL,
  service_ids          uuid[] NOT NULL DEFAULT '{}',
  preferred_dates      date[] NOT NULL DEFAULT '{}',
  budget_range         text,
  location_type        location_type NOT NULL,
  address              jsonb,
  zone_id              uuid REFERENCES service_zones(id) ON DELETE SET NULL,
  out_of_area          boolean NOT NULL DEFAULT false,
  attribution          jsonb NOT NULL DEFAULT '{}',
  quoted_price_cents   integer CHECK (quoted_price_cents >= 0),
  quoted_duration_min  integer CHECK (quoted_duration_min > 0),
  quoted_deposit_cents integer CHECK (quoted_deposit_cents >= 0),
  quote_message        text,
  quote_token_hash     bytea UNIQUE,
  quote_token_version  smallint NOT NULL DEFAULT 0,
  quote_expires_at     timestamptz,
  quoted_at            timestamptz,
  quoted_by            text,
  responded_at         timestamptz,
  decline_reason       text,
  booking_id           uuid UNIQUE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'quoted' OR (quoted_price_cents IS NOT NULL AND quoted_duration_min IS NOT NULL AND quote_token_hash IS NOT NULL))
);
CREATE INDEX quote_requests_status_idx ON quote_requests (status, created_at DESC);

-- ─── Bookings ────────────────────────────────────────────────────────────────
CREATE TABLE bookings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number                 text NOT NULL UNIQUE,
  status                 booking_status NOT NULL,
  customer_id            uuid REFERENCES customers(id),
  quote_request_id       uuid REFERENCES quote_requests(id),
  source                 booking_source NOT NULL DEFAULT 'web',
  location_type          location_type NOT NULL,
  address                jsonb,
  access_notes           text,
  zone_id                uuid REFERENCES service_zones(id) ON DELETE SET NULL,
  vehicle_size_id        text NOT NULL REFERENCES vehicle_sizes(id),
  vehicle_year           smallint,
  vehicle_make           text,
  vehicle_model          text,
  vehicle_color          text,
  condition_ids          text[] NOT NULL DEFAULT '{}',
  selection              jsonb NOT NULL,
  price_snapshot         jsonb NOT NULL,
  subtotal_cents         integer NOT NULL,
  surcharge_cents        integer NOT NULL DEFAULT 0,
  travel_fee_cents       integer NOT NULL DEFAULT 0,
  discount_cents         integer NOT NULL DEFAULT 0,
  tax_cents              integer NOT NULL DEFAULT 0,
  total_cents            integer NOT NULL,
  deposit_cents          integer NOT NULL,
  balance_paid_cents     integer NOT NULL DEFAULT 0,
  promo_code_id          uuid REFERENCES promo_codes(id),
  duration_min           integer NOT NULL CHECK (duration_min > 0),
  starts_at              timestamptz NOT NULL,
  ends_at                timestamptz NOT NULL,
  timezone               text NOT NULL,
  manage_token_hash      bytea UNIQUE,
  manage_token_version   smallint NOT NULL DEFAULT 1,
  idempotency_key        text NOT NULL UNIQUE,
  hold_extensions        smallint NOT NULL DEFAULT 0,
  reschedule_count       smallint NOT NULL DEFAULT 0,
  cancelled_at           timestamptz,
  cancelled_by           event_actor,
  cancel_reason          text,
  cancellation_fee_cents integer,
  fee_owed_cents         integer NOT NULL DEFAULT 0,
  refund_cents           integer,
  attribution            jsonb NOT NULL DEFAULT '{}',
  heard_about            text,
  lead_consent_at        timestamptz,
  internal_notes         text NOT NULL DEFAULT '',
  confirmed_at           timestamptz,
  completed_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (total_cents = subtotal_cents + surcharge_cents + travel_fee_cents - discount_cents + tax_cents),
  CHECK (deposit_cents BETWEEN 0 AND total_cents),
  CHECK (status IN ('held', 'expired') OR customer_id IS NOT NULL)
);
CREATE INDEX bookings_status_start_idx ON bookings (status, starts_at);
CREATE INDEX bookings_customer_idx ON bookings (customer_id, starts_at DESC);
CREATE INDEX bookings_created_idx ON bookings (created_at);

ALTER TABLE quote_requests
  ADD CONSTRAINT quote_requests_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

-- Holds, bookings and admin time-blocks share ONE constraint: no two active allocations
-- on the same crew/bay may overlap. This is the database-level double-booking guarantee.
CREATE TABLE resource_allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id     uuid NOT NULL REFERENCES resources(id),
  kind            allocation_kind NOT NULL,
  booking_id      uuid REFERENCES bookings(id) ON DELETE CASCADE,
  period          tstzrange NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  hold_expires_at timestamptz,
  note            text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT isempty(period) AND lower_inc(period) AND NOT upper_inc(period)),
  CHECK (kind = 'block' OR booking_id IS NOT NULL),
  CONSTRAINT no_double_booking EXCLUDE USING gist (resource_id WITH =, period WITH &&) WHERE (active)
);
CREATE UNIQUE INDEX one_active_alloc_per_booking ON resource_allocations (booking_id) WHERE active AND kind = 'booking';
CREATE INDEX resource_allocations_hold_idx ON resource_allocations (hold_expires_at) WHERE active AND hold_expires_at IS NOT NULL;
CREATE INDEX resource_allocations_booking_idx ON resource_allocations (booking_id);

CREATE TABLE booking_events (
  id          bigserial PRIMARY KEY,
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type        text NOT NULL,
  from_status booking_status,
  to_status   booking_status,
  actor       event_actor NOT NULL,
  actor_id    text,
  data        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_events_booking_idx ON booking_events (booking_id, created_at);

CREATE TABLE payments (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                 uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  kind                       payment_kind NOT NULL,
  method                     payment_method NOT NULL DEFAULT 'stripe',
  amount_cents               integer NOT NULL CHECK (amount_cents >= 0),
  status                     payment_status NOT NULL DEFAULT 'open',
  attempt                    smallint NOT NULL DEFAULT 1,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id   text UNIQUE,
  stripe_refund_id           text UNIQUE,
  idempotency_key            text NOT NULL UNIQUE,
  raw                        jsonb NOT NULL DEFAULT '{}',
  note                       text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_booking_idx ON payments (booking_id);
-- A second paid deposit for the same booking (e.g. two tabs) violates this → auto-refund path.
CREATE UNIQUE INDEX one_paid_deposit ON payments (booking_id) WHERE kind = 'deposit' AND status = 'succeeded';

CREATE TABLE webhook_events (
  id           text PRIMARY KEY,
  provider     webhook_provider NOT NULL,
  type         text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error        text
);

-- ─── Uploads & leads ─────────────────────────────────────────────────────────
CREATE TABLE quote_photos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_session_id uuid NOT NULL,
  quote_request_id  uuid REFERENCES quote_requests(id) ON DELETE CASCADE,
  storage_key       text NOT NULL UNIQUE,
  content_type      text NOT NULL,
  size_bytes        integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  width             integer,
  height            integer,
  status            photo_status NOT NULL DEFAULT 'pending',
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_photos_session_idx ON quote_photos (upload_session_id);

CREATE TABLE leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id      uuid UNIQUE,
  source             lead_source NOT NULL,
  status             lead_status NOT NULL DEFAULT 'new',
  name               text,
  email              citext,
  phone_e164         text,
  message            text,
  customer_id        uuid REFERENCES customers(id) ON DELETE SET NULL,
  booking_id         uuid UNIQUE REFERENCES bookings(id) ON DELETE SET NULL,
  quote_request_id   uuid REFERENCES quote_requests(id) ON DELETE SET NULL,
  consent_contact_at timestamptz,
  attribution        jsonb NOT NULL DEFAULT '{}',
  notes              text NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_status_idx ON leads (status, created_at DESC);

-- ─── Content ─────────────────────────────────────────────────────────────────
CREATE TABLE testimonials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name    text NOT NULL,
  vehicle        text,
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body           text NOT NULL,
  source         review_source NOT NULL DEFAULT 'google',
  source_url     text,
  review_date    date,
  is_placeholder boolean NOT NULL DEFAULT true,
  published      boolean NOT NULL DEFAULT true,
  sort           integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gallery_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      uuid REFERENCES services(id) ON DELETE SET NULL,
  title           text NOT NULL,
  vehicle         text,
  before_src      text NOT NULL,
  after_src       text NOT NULL,
  width           integer NOT NULL DEFAULT 1600,
  height          integer NOT NULL DEFAULT 1067,
  alt_before      text NOT NULL,
  alt_after       text NOT NULL,
  is_placeholder  boolean NOT NULL DEFAULT true,
  published       boolean NOT NULL DEFAULT true,
  sort            integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE faqs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text NOT NULL,
  answer_md  text NOT NULL,
  category   text NOT NULL DEFAULT 'General',
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  sort       integer NOT NULL DEFAULT 0,
  published  boolean NOT NULL DEFAULT true,
  featured   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE city_pages (
  slug           citext PRIMARY KEY,
  city           text NOT NULL,
  region         text NOT NULL,
  zone_id        uuid REFERENCES service_zones(id) ON DELETE SET NULL,
  intro_md       text NOT NULL,
  local_notes_md text NOT NULL DEFAULT '',
  published      boolean NOT NULL DEFAULT true,
  is_placeholder boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── Operations ──────────────────────────────────────────────────────────────
CREATE TABLE outbox (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text NOT NULL,
  payload          jsonb NOT NULL DEFAULT '{}',
  run_at           timestamptz NOT NULL,
  status           outbox_status NOT NULL DEFAULT 'pending',
  attempts         smallint NOT NULL DEFAULT 0,
  max_attempts     smallint NOT NULL DEFAULT 6,
  last_error       text,
  dedupe_key       text NOT NULL UNIQUE,
  booking_id       uuid REFERENCES bookings(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE CASCADE,
  quote_request_id uuid REFERENCES quote_requests(id) ON DELETE CASCADE,
  locked_until     timestamptz,
  provider_id      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  done_at          timestamptz
);
CREATE INDEX outbox_due_idx ON outbox (run_at) WHERE status = 'pending';
CREATE INDEX outbox_booking_idx ON outbox (booking_id);

CREATE TABLE rate_limits (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE funnel_events (
  id         bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  event      text NOT NULL,
  step       text,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  utm_source text,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX funnel_events_at_idx ON funnel_events (at);
CREATE INDEX funnel_events_session_idx ON funnel_events (session_id);

CREATE TABLE cron_runs (
  id          bigserial PRIMARY KEY,
  started_at  timestamptz NOT NULL,
  finished_at timestamptz,
  processed   integer NOT NULL DEFAULT 0,
  error       text
);

-- ─── Admin auth (Better Auth models; JS field names map to these columns) ────
CREATE TABLE "user" (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  email              text NOT NULL UNIQUE,
  email_verified     boolean NOT NULL DEFAULT false,
  image              text,
  role               admin_role NOT NULL DEFAULT 'staff',
  two_factor_enabled boolean DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session (
  id          text PRIMARY KEY,
  expires_at  timestamptz NOT NULL,
  token       text NOT NULL UNIQUE,
  ip_address  text,
  user_agent  text,
  user_id     text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_user_idx ON session (user_id);

CREATE TABLE account (
  id                       text PRIMARY KEY,
  account_id               text NOT NULL,
  provider_id              text NOT NULL,
  user_id                  text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token             text,
  refresh_token            text,
  id_token                 text,
  access_token_expires_at  timestamptz,
  refresh_token_expires_at timestamptz,
  scope                    text,
  password                 text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_user_idx ON account (user_id);

CREATE TABLE verification (
  id         text PRIMARY KEY,
  identifier text NOT NULL,
  value      text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_identifier_idx ON verification (identifier);

CREATE TABLE two_factor (
  id                        text PRIMARY KEY,
  secret                    text NOT NULL,
  backup_codes              text NOT NULL,
  user_id                   text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  verified                  boolean DEFAULT true,
  failed_verification_count integer DEFAULT 0,
  locked_until              timestamptz
);
CREATE INDEX two_factor_user_idx ON two_factor (user_id);
CREATE INDEX two_factor_secret_idx ON two_factor (secret);

CREATE TABLE admin_audit_log (
  id        bigserial PRIMARY KEY,
  user_id   text REFERENCES "user"(id) ON DELETE SET NULL,
  action    text NOT NULL,
  entity    text NOT NULL,
  entity_id text,
  diff      jsonb NOT NULL DEFAULT '{}',
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_at_idx ON admin_audit_log (at DESC);
