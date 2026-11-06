# PLAN — Premium Car Detailing Website + Booking System

> Phase 1 output. Researched 2026-10-22. On approval this file is committed verbatim as `/docs/PLAN.md` (the first commit of Phase 2), and nothing else is built before that.

## Context

You need a production-ready, lead-generating site for a car detailing business. It has to look premium (3D scroll hero, cinematic motion, smooth route transitions) and stay fast. It also needs a booking system that can't double-book: service selection or custom quote, then vehicle, location, slot hold, contact, Stripe deposit and a confirmed appointment, plus a manage link for the customer and an admin dashboard for the owner. The brief asks for PLAN → BUILD → VERIFY with approval between PLAN and BUILD. This is a greenfield project with no existing code to reuse. Business-specific values haven't been supplied yet, so they become clearly marked placeholders (§16).

---

## 0. Decisions

### Your answers (2026-10-22)
| Question | Decision |
|---|---|
| Settings source of truth (§0 vs §6 contradiction) | `config/business.ts` holds brand, contact, flags and the **default** operational values. `db/seed.ts` copies those defaults into the DB, and after that the admin dashboard is the live source for hours, blackouts, capacity, zones, deposit and policies. Changing hours needs no redeploy. |
| Local/test Postgres | `embedded-postgres` (official PG 18 binaries via npm) is started automatically by `pnpm dev:db` and by the test harness. Docker Compose ships for deployment only. |
| Travel time | Fixed travel minutes and fee per service zone, editable by the owner and enforced inside the DB constraint. No routing API. |
| Jobs longer than any business day | Routed to the quote path. The owner schedules multi-day work from admin using time blocks. |

### Choices I made where the brief left room (justified in §1)
- **Drizzle** over Prisma.
- **Better Auth** instead of Auth.js/Clerk. *Deviation:* Auth.js has been maintained by the Better Auth team since Sept 2025, and that team recommends Better Auth for new projects. Clerk would add a paid external identity service for one or two admin users.
- **Stripe Checkout Sessions + Payment Element** (`ui_mode: "elements"`) rather than raw PaymentIntents. It's still the embedded Payment Element; Stripe now recommends Checkout Sessions for most integrations, with built-in session expiry and lifecycle webhooks.
- **React's built-in `<ViewTransition>`** (stable in React 19.3, wired into Next 16.4 routing with no flag) instead of `next-view-transitions`.
- **Vercel Pro** as the primary host (5-minute cron), with **Docker** fully documented as the alternative.
- **Plausible** for analytics: cookieless, so no consent banner unless GA4/Meta/Ads are switched on.
- **Cloudflare R2** for uploads.
- **Google Places API (New)**, proxied server-side, for address autocomplete and geocoding. The brief requires autocomplete and radius zones but names no provider.
- **shadcn initialised with `-b radix`.** shadcn's default switched to Base UI in July 2026; the brief specifies Radix, which is still fully supported.

### Defaults for optional features (change before approval if you disagree)
- **Gift cards** (flag, off): v1 is a page linking to a Stripe Payment Link the owner creates. Redemption is applied manually as a discount in admin. Full online redemption could be a later phase.
- **Memberships** (flag, off): a teaser section with an inquiry CTA only, no recurring billing.
- **Exit-intent offer** (flag, off): desktop only, never on mobile, `/book` or `/admin`.

---

## 1. Tech stack

**Version policy.** Exact versions are pinned in the lockfile. pnpm `minimumReleaseAge: 10080` (7 days) skips any release less than a week old, which protects against supply-chain attacks. For example, `@hookform/resolvers@6.0.0`, published 3 days ago, falls back to 5.x. Dependency install scripts are blocked except for an explicit allowlist. Versions below are npm `latest` on 2026-10-22.

| Area | Package(s) | Version | Why |
|---|---|---|---|
| Runtime | Node.js | 24 LTS (26 when Vercel Functions offer it) | Already installed here (24.18). Temporal is native only on Node 26, so we use a server-side polyfill until then. |
| Package manager | pnpm | 12.x | Blocks dependency lifecycle scripts by default and supports release-age gating. |
| Framework | next | 16.4.x | App Router, Turbopack (default), **Cache Components** (`cacheComponents: true`, `partialPrefetching: true`; recommended for all apps as of 16.4), `ensureStatic` to guarantee static marketing routes, `proxy.ts`. |
| UI runtime | react / react-dom | 19.3.x | `<ViewTransition>` and `addTransitionType` are stable. |
| Types | typescript (as `npm:@typescript/typescript6@6.0.x`) + `@typescript/native` (as `npm:typescript@7.0.x`) | 6.0 / 7.0 | TS 7 (Go-native) ships without a JS API until 7.1, and typescript-eslint's peer range is `<6.1`. Following Microsoft's guidance: tooling uses the TS6 package, and `pnpm typecheck` runs TS 7 `tsc` (~10× faster). `strict` plus `noUncheckedIndexedAccess` everywhere. |
| Styling | tailwindcss, @tailwindcss/postcss | 4.3.x | CSS-first config; design tokens as CSS variables. |
| Components | shadcn (CLI), radix-ui | 4.x / 1.8.x | Accessible Dialog, Popover, RadioGroup, Accordion, Select, Checkbox, Tabs, Sheet. Copied into the repo, so there's no runtime lock-in. |
| Calendar | react-day-picker | 10.x | Used by shadcn Calendar; keyboard accessible. |
| Icons | lucide-react | 1.x | Tree-shaken per icon. |
| Fonts | next/font/google | — | Max 2 families, self-hosted, preloaded. Archivo uses `display: optional` (a late swap re-lays out the page and blew the mobile TBT budget); the accent serif uses `swap`. Default is **Archivo** (variable `wdth` axis: expanded cut for headlines, normal for UI), so one family covers both. A second is added only if the design pass needs it. |
| Motion | gsap (+ScrollTrigger, SplitText), @gsap/react | 3.15.x / 2.1.x | Free including all plugins since 3.13. 3.15 adds `easeReverse` and deprecates `yoyoEase`. `useGSAP` handles cleanup; `gsap.matchMedia()` handles breakpoints and reduced motion. |
| Smooth scroll | lenis (`lenis/react`) | 1.3.x | Driven from `gsap.ticker` with `lagSmoothing(0)`. `syncTouch: false` (native touch), `anchors: true`, `respectReducedMotion: true` (forces lerp 1). |
| 3D | three, @react-three/fiber, @react-three/drei | 0.186.x / 9.8.x / 10.7.x | Only `useGLTF`, `Environment` and `Lightformer` from drei, so the env map is procedural and costs zero bytes to download. |
| Model pipeline (dev) | @gltf-transform/cli, gltfjsx | 4.5.x / 6.5.x | Meshopt geometry, KTX2 textures, prune/dedupe; typed JSX component. |
| ORM | drizzle-orm, drizzle-kit, pg | 0.45.x / 0.31.x / 8.x | SQL-first control for the parts that must be bulletproof: `tstzrange`, exclusion constraints, savepoints, `FOR UPDATE SKIP LOCKED`. No codegen step, and a small serverless footprint. Prisma's CLI `latest` tag currently points at an 8.0 RC. Drizzle 1.0 is still RC, so we pin 0.45 and note a future upgrade. |
| DB | PostgreSQL | 18 (17+ OK) | Extensions `btree_gist` and `citext`, available on Neon, Supabase, DO and RDS. |
| Pooling (Vercel) | @vercel/functions | latest | `attachDatabasePool` for Fluid compute; no-op elsewhere. |
| Validation / forms | zod, react-hook-form, @hookform/resolvers | 4.6.x / 7.x / 5.x | Shared client/server schemas; RHF keeps inputs uncontrolled, which helps INP. |
| Time | Temporal (`temporal-polyfill` on Node 24) | 1.0.x | DST-correct wall-clock ↔ instant conversion with explicit disambiguation. Server only; the client formats with `Intl.DateTimeFormat`, so no date library ships to the browser. |
| Phone | libphonenumber-js (min metadata) | 1.13.x | E.164 normalisation and formatting. Loaded only in the booking step chunk and on the server. |
| Payments | stripe, @stripe/stripe-js, @stripe/react-stripe-js (`/checkout` entry) | 23.x / 10.x / 7.x | Checkout Sessions in `ui_mode: "elements"`, `CheckoutElementsProvider`, `checkout.confirm()`. API version pinned in code. |
| Email | resend, @react-email/components, react-email (dev) | 6.x / 1.x / 6.x | Transactional templates written as React components. |
| SMS | twilio | 6.x | Messaging Service, Advanced Opt-Out, status callbacks. |
| Admin auth | better-auth | 1.7.x | Email + password with sign-up disabled, TOTP 2FA plugin, DB sessions via the Drizzle adapter, `owner`/`staff` roles. |
| Uploads | @aws-sdk/client-s3, @aws-sdk/s3-request-presigner | 3.x | R2 presigned PUT. R2 doesn't document POST-policy uploads, so size is enforced by signing `Content-Length` and checking with a HEAD request after upload. |
| Admin drag & drop | @dnd-kit/core | 6.3.x | Keyboard sensor included; admin bundle only. |
| RUM | web-vitals | 6.x | ~2 KB, loaded after idle. Reports field INP, LCP and CLS to Plausible, since INP can't be measured in the lab. |
| Unit / integration tests | vitest | 5.0.x | |
| E2E | @playwright/test | 1.64.x | Projects: desktop-chrome, mobile-safari (WebKit iPhone), mobile-chrome (Pixel), plus a smoke subset on desktop-firefox, desktop-webkit and msedge (installed on Windows). |
| A11y | @axe-core/playwright | 4.14.x | |
| Perf CI | @lhci/cli | 0.15.x | Assertions plus budgets on mobile and desktop presets. |
| Test DB | embedded-postgres | 18.x | Has Windows/macOS/Linux binary packages. |
| Lint / format | eslint 10 + eslint-config-next 16.4 + typescript-eslint 8.x, prettier 3 | | `next lint` was removed in Next 16, so ESLint runs directly. |

**Deliberately not added:** `next-view-transitions` (React has it built in now); motion/framer-motion (GSAP covers it); XState (a typed reducer is enough); date-fns/luxon (Temporal + Intl); FullCalendar (custom CSS-grid calendar + dnd-kit); chart libraries (CSS/SVG bars); Upstash/Redis (Postgres rate limiter); `browser-image-compression` (`createImageBitmap` + `OffscreenCanvas.convertToBlob`); an `ics` library (a ~60-line RFC 5545 writer, unit-tested); `@marsidev/react-turnstile` (a ~40-line component); `cmdk` (a Radix Popover + ARIA listbox combobox); Sentry (optional later); `detect-gpu` (a capability heuristic plus a runtime FPS guard instead).

### Breaking changes and gotchas found in research
- **Next 16.x:** `middleware.ts` → `proxy.ts`. `params`, `searchParams`, `cookies()` and `headers()` are async-only. `revalidateTag(tag, profile)` needs a profile, and `updateTag()` gives read-your-writes in Server Actions. `next lint` is gone. Turbopack is the default. Node ≥ 20.9.
- **Next 16.4:** Cache Components are recommended and default for new apps. New `ensureStatic = 'navigation' | 'prefetch' | 'shell'`. New `navigation()` / `prefetch()` deferral APIs. View transitions need **no config**, and `<Link transitionTypes>` is supported.
- **Nonce CSP needs dynamic rendering** and doesn't work with prerendered shells. Static marketing pages therefore get a header CSP with a host allowlist (still needs `'unsafe-inline'` for Next's inline RSC scripts, but no `'unsafe-eval'`). `/book`, `/booking/*`, `/quote/*` and `/admin/*` render dynamically with a strict nonce CSP (§9).
- **React 19.3:** `ViewTransition` is imported from `'react'` (no `unstable_` prefix). It only animates updates inside Transitions, Suspense reveals or `useDeferredValue`.
- **TypeScript 7:** has no JS API, hence the TS6 compatibility alias above. The Next docs disagree on whether `experimental.useTypeScriptCli` is needed; this gets settled at scaffold time.
- **shadcn:** Base UI became the default on 2026-07-03, so we pass `-b radix`.
- **Lenis:** the package is `lenis`, not the deprecated `@studio-freight/lenis`. Anchor links need `anchors: true`, and `import 'lenis/dist/lenis.css'` is required.
- **Stripe:** for React, use `@stripe/react-stripe-js/checkout`, `CheckoutElementsProvider` and `checkout.confirm()`. The docs alternate between `ui_mode: "elements"` and `"custom"`, so we verify against the pinned API version.
- **Vercel Cron:** Hobby allows once per day only, so reminders and hold sweeps need Pro (per-minute) or an external scheduler.
- **Twilio (US):** application SMS needs A2P 10DLC registration (~10–15 business days) or toll-free verification (~3–5 days; business registration number required since 2026-02-17). The README recommends toll-free.
- **Google Maps Platform:** free caps are per SKU (~10k/month for Essentials). Autocomplete sessions must be closed by a Place Details call or each keystroke is billed.
- **GSAP 3.15:** `yoyoEase` is deprecated in favour of `easeReverse`.
- **Drizzle 1.0 is RC** (breaking changes to relational queries and migrations). We stay on 0.45 and add an upgrade note to the README.

---

## 2. Site map

Route groups: `(marketing)` uses `ensureStatic = 'navigation'` in its layout, so the build fails if anything dynamic sneaks in. Catalog and content reads use `'use cache'` with `cacheTag('catalog' | 'content' | 'settings')`, and admin edits call `revalidateTag(tag, 'max')`.

| Route | Render | Purpose |
|---|---|---|
| `/` | static | Home: 12 sections (§6) |
| `/services` | static | Category cards |
| `/services/[slug]` | static (`generateStaticParams`) | Description, included items, duration, price by size, add-ons, gallery, FAQ, CTA to `/book?svc=<slug>`; shared-element morph from card |
| `/pricing` | static | Full size × service table, add-ons, travel fees |
| `/gallery` | static | Filter by service, lightbox, lazy below the fold |
| `/about`, `/reviews`, `/faq` | static | `/faq` emits FAQPage JSON-LD |
| `/contact` | static shell + client form | Form → lead (Server Action); phone, hours, click-to-load map facade |
| `/quote` | static shell + client form | Standalone custom-job request (same flow as wizard 3B) |
| `/quote/[token]` | dynamic, noindex | Customer views a quote → "Book this" (`/book?quote=<token>`) or "Decline" |
| `/book` | dynamic (strict CSP), noindex | The wizard (§4) |
| `/book/return` | dynamic, noindex | Stripe redirect target after 3-D Secure; resolves to the confirmation view |
| `/booking/[token]` | dynamic, noindex, `Referrer-Policy: no-referrer` | Confirmation and manage view: details, add to calendar, reschedule, cancel |
| `/booking/[token]/calendar.ics` | route handler | iCalendar download |
| `/areas/[city]` | static (published cities only) | Local landing pages |
| `/gift-cards` | static, flag | Payment Link page |
| `/privacy`, `/terms`, `/cancellation-policy`, `/accessibility` | static | Legal pages (the last one is Added by Claude) |
| `not-found`, `error`, `global-error` | — | Styled 404 and error pages |
| `/admin/login` | dynamic | Password + TOTP |
| `/admin` | dynamic | Metrics overview and health panel |
| `/admin/calendar` | dynamic | Day/week resource calendar, drag to reschedule |
| `/admin/bookings`, `/admin/bookings/[id]` | dynamic | List, filters, detail, status changes, notes, payments |
| `/admin/leads`, `/admin/quotes`, `/admin/quotes/[id]` | dynamic | Inbox; send a priced quote |
| `/admin/customers`, `/admin/customers/[id]` | dynamic | History, anonymise |
| `/admin/catalog` | dynamic | Services, packages, add-ons, sizes, rules, conditions |
| `/admin/schedule` | dynamic | Hours, blackouts, resources (crews/bays), time blocks |
| `/admin/area` | dynamic | Zones, ZIPs, radius rings, travel fee/minutes, city pages |
| `/admin/settings` | dynamic | Deposit, cancellation/reschedule policy, lead time, hold length, flags, notifications |
| `/admin/content` | dynamic | Testimonials, gallery, FAQs (replacing placeholders) |
| `/admin/promos` | dynamic | Promo codes |
| `/admin/export` | dynamic | CSV export (bookings, customers, leads) |
| `/api/availability` | GET | Slots for a date range (rate-limited) |
| `/api/places/autocomplete`, `/api/places/details` | GET | Server-side Places proxy (key never reaches the browser) |
| `/api/uploads/sign` | POST | Presigned PUT for quote photos |
| `/api/stripe/webhook` | POST | Signature-verified, deduplicated |
| `/api/twilio/inbound`, `/api/twilio/status` | POST | STOP/HELP handling and delivery receipts (signature-verified) |
| `/api/cron/tick` | GET (`CRON_SECRET`) | Sweep holds, process the outbox, expire quotes |
| `/api/events` | POST (beacon) | Anonymous funnel events |
| `/api/auth/[...all]` | — | Better Auth |
| `/api/health` | GET | DB ping and last cron run, for uptime checks and the Docker healthcheck |
| `sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx` per segment, `icon` | metadata | |

Most mutations are Server Actions in `lib/server/actions/*`, each with Zod validation, the rate limiter, and (for public forms) Turnstile.

---

## 3. Database schema

Conventions: `uuid` PKs (`gen_random_uuid()`), money in integer cents, every timestamp `timestamptz`, and `created_at`/`updated_at` on every table. Enum types are Postgres enums. Custom SQL lives in hand-written migrations (`drizzle-kit generate --custom`) for the extensions, the exclusion constraint and partial indexes.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- lets uuid "=" join "&&" in one GiST exclusion constraint
CREATE EXTENSION IF NOT EXISTS citext;
```

**Catalog** (editable in admin, seeded from `db/seed.ts`)
```
vehicle_sizes(id text PK /*sedan|suv|truck|van*/, label, description, price_multiplier numeric(4,2) CHECK >0,
              duration_multiplier numeric(4,2) CHECK >0, sort, active)
service_categories(id, slug citext UNIQUE, name, description, sort)
services(id, slug citext UNIQUE, category_id→service_categories, kind enum(service|addon), name, summary, description_md,
         includes text[], what_to_expect text[], base_price_cents int CHECK ≥0, base_duration_min int CHECK >0,
         quote_only bool, location_types location_type[] /*mobile,shop*/, active, sort, seo_title, seo_description,
         hero_media_id→media NULL)                                  INDEX(category_id, sort) WHERE active
service_size_prices(service_id→services CASCADE, size_id→vehicle_sizes, price_cents NULL, duration_min NULL, PK(service_id,size_id))
packages(id, slug UNIQUE, name, tier smallint, tagline, base_price_cents, base_duration_min, featured, active, sort)
package_items(package_id→packages CASCADE, service_id→services, PK(package_id,service_id))
package_size_prices(package_id, size_id, price_cents NULL, duration_min NULL, PK(package_id,size_id))
service_rules(id, kind enum(requires|excludes), service_id→services, target_service_id→services, reason text NOT NULL,
              UNIQUE(kind,service_id,target_service_id), CHECK(service_id<>target_service_id))
conditions(id text PK /*light|moderate|heavy|pet_hair|stains…*/, group enum(soil|extra), label,
           surcharge_type enum(flat|percent), surcharge_value int ≥0, extra_minutes int ≥0, sort, active)
promo_codes(id, code citext UNIQUE, kind enum(percent|fixed), value int >0, starts_at, ends_at, max_redemptions NULL,
            redemption_count int DEFAULT 0, first_booking_only bool, active, CHECK(kind<>'percent' OR value<=100))
```

**Scheduling**
```
settings(id smallint PK CHECK(id=1), data jsonb NOT NULL /*validated by OperationalSettingsSchema (Zod)*/, version int, updated_at, updated_by)
   -- timezone, slotIntervalMin, bufferMin, minLeadHours, maxDaysAhead, holdMinutes, paymentHoldMinutes, serviceMode,
   -- base {lat,lng,address}, travelCountsAgainstHours, deposit{mode none|fixed|percent, value}, cancellation{windowHours,
   -- lateFee{type forfeit_deposit|fixed|percent, value}}, reschedule{minHoursBefore,maxCount}, taxRateBps, taxTravel,
   -- priceRoundingCents, reminders{h24,h2,reviewDelayH}, smsQuietHours{start,end}, flags{…}
business_hours(id, weekday smallint CHECK 0..6, opens time, closes time, CHECK(opens<closes), UNIQUE(weekday,opens))  -- multiple intervals/day allowed
blackout_dates(date date PK, reason)
resources(id, name, type enum(mobile_crew|shop_bay), active, sort, color)
service_zones(id, name, zip_codes text[], ring_max_km numeric NULL, travel_fee_cents ≥0, travel_minutes ≥0, cities text[], sort, active)
                                                                  GIN(zip_codes)
resource_allocations(                                             -- holds, bookings and admin time-blocks share ONE constraint
  id, resource_id→resources, kind enum(booking|block), booking_id→bookings NULL,
  period tstzrange NOT NULL CHECK(NOT isempty(period) AND lower_inc(period) AND NOT upper_inc(period)),  -- [start-travel, end+buffer)
  active bool NOT NULL DEFAULT true, hold_expires_at timestamptz NULL, note, created_by,
  CHECK(kind='block' OR booking_id IS NOT NULL),
  CONSTRAINT no_double_booking EXCLUDE USING gist (resource_id WITH =, period WITH &&) WHERE (active))
UNIQUE INDEX one_active_alloc_per_booking ON resource_allocations(booking_id) WHERE active AND kind='booking'
INDEX ON resource_allocations(hold_expires_at) WHERE active AND hold_expires_at IS NOT NULL
```

**Customers and bookings**
```
customers(id, name, email citext, phone_e164, preferred_contact enum(email|sms|call), sms_consent_at, sms_consent_text_version,
          sms_consent_ip inet, sms_opt_out_at, marketing_consent_at, notes, anonymized_at)
          UNIQUE(email) WHERE anonymized_at IS NULL; INDEX(phone_e164)
bookings(
  id, number text UNIQUE /*e.g. DS-7K3QX, Crockford base32*/, status booking_status NOT NULL,
  customer_id→customers NULL, quote_request_id→quote_requests NULL, source enum(web|admin|quote),
  location_type enum(mobile|shop), address jsonb NULL /*line1,line2,city,region,postal,country,lat,lng,place_id*/,
  access_notes /*water/power*/, zone_id→service_zones NULL,
  vehicle_size_id→vehicle_sizes, vehicle_year smallint NULL, vehicle_make, vehicle_model, vehicle_color, condition_ids text[],
  selection jsonb NOT NULL /*as submitted*/, price_snapshot jsonb NOT NULL /*server-computed lines + rule notes*/,
  subtotal_cents, surcharge_cents, travel_fee_cents, discount_cents, tax_cents, total_cents, deposit_cents,
  balance_paid_cents DEFAULT 0, promo_code_id→promo_codes NULL,
  duration_min, starts_at, ends_at, timezone,
  manage_token_hash bytea UNIQUE, idempotency_key text UNIQUE NOT NULL,
  reschedule_count smallint DEFAULT 0, cancelled_at, cancelled_by, cancel_reason, cancellation_fee_cents, refund_cents,
  attribution jsonb /*utm_*, referrer, landing_path, first_seen_at*/, heard_about, lead_consent_at NULL, internal_notes,
  confirmed_at, completed_at,
  CHECK(ends_at > starts_at),
  CHECK(total_cents = subtotal_cents + surcharge_cents + travel_fee_cents - discount_cents + tax_cents),
  CHECK(deposit_cents BETWEEN 0 AND total_cents),
  CHECK(status IN ('held','expired') OR customer_id IS NOT NULL))
  INDEX(status, starts_at); INDEX(customer_id, starts_at DESC); INDEX(created_at)
booking_status = held | pending_payment | confirmed | in_progress | completed | cancelled | no_show | expired
booking_events(id bigserial, booking_id→bookings, type, from_status, to_status, actor enum(customer|admin|system|stripe), actor_id, data jsonb)
                                                                  INDEX(booking_id, created_at)
payments(id, booking_id→bookings, kind enum(deposit|balance|refund), method enum(stripe|cash|card_terminal|other), amount_cents,
         status enum(open|succeeded|failed|expired|refunded|partially_refunded|cancelled), attempt smallint,
         stripe_checkout_session_id UNIQUE NULL, stripe_payment_intent_id UNIQUE NULL, stripe_refund_id UNIQUE NULL,
         idempotency_key UNIQUE, raw jsonb)
UNIQUE INDEX one_paid_deposit ON payments(booking_id) WHERE kind='deposit' AND status='succeeded'   -- 2nd paid deposit ⇒ auto-refund
webhook_events(id text PK /*provider event id*/, provider enum(stripe|twilio), type, received_at, processed_at NULL, error NULL)
```

**Quotes, leads and uploads**
```
quote_requests(id, number UNIQUE /*Q-…*/, submission_id uuid UNIQUE, status enum(new|quoted|accepted|declined|expired),
  customer_id→customers, vehicle_size_id, vehicle_year/make/model/color, description, service_ids uuid[], preferred_dates date[],
  budget_range NULL, location_type, address jsonb, zone_id NULL, out_of_area bool, attribution jsonb,
  quoted_price_cents NULL, quoted_duration_min NULL, quoted_deposit_cents NULL, quote_message, quote_token_hash bytea UNIQUE NULL,
  quote_expires_at NULL, quoted_at, quoted_by, responded_at, decline_reason, booking_id→bookings UNIQUE NULL,
  CHECK(status<>'quoted' OR (quoted_price_cents IS NOT NULL AND quoted_duration_min IS NOT NULL AND quote_token_hash IS NOT NULL)))
quote_photos(id, upload_session_id uuid NOT NULL, quote_request_id→quote_requests NULL, storage_key UNIQUE, content_type,
             size_bytes CHECK(size_bytes <= 15728640), width, height, status enum(pending|uploaded|attached|rejected))
             INDEX(upload_session_id)   -- R2 lifecycle rule deletes unattached objects under pending/ after 24h
leads(id, submission_id uuid UNIQUE NULL, source enum(booking_abandoned|contact_form|quote|exit_offer|admin),
      status enum(new|contacted|won|lost|spam), name, email citext, phone_e164, message, customer_id NULL, booking_id UNIQUE NULL,
      quote_request_id NULL, consent_contact_at, attribution jsonb)      INDEX(status, created_at DESC)
```

**Content** (managed in admin; `is_placeholder` drives visible "Sample" labels and the launch check)
```
media(id, storage_key UNIQUE, url, content_type, width, height, blur_data_url, alt, size_bytes)
testimonials(id, author_name, vehicle NULL, rating smallint CHECK 1..5, body, source enum(google|yelp|facebook|direct), source_url,
             review_date, is_placeholder bool DEFAULT true, published, sort)
gallery_items(id, service_id NULL, title, vehicle, before_media_id→media, after_media_id→media, alt_before, alt_after,
              is_placeholder, published, sort)
faqs(id, question, answer_md, category, service_id NULL, sort, published)
city_pages(slug citext PK, city, region, zone_id→service_zones, intro_md, local_notes_md, published, is_placeholder)
```

**Operations**
```
outbox(id, type /*email|sms|stripe.expire_session|stripe.refund|gcal.upsert|gcal.delete*/, payload jsonb, run_at, status
       enum(pending|running|done|failed|cancelled|skipped), attempts, max_attempts DEFAULT 6, last_error, dedupe_key UNIQUE,
       booking_id NULL, lead_id NULL, quote_request_id NULL, locked_until NULL, done_at)
       INDEX(run_at) WHERE status='pending'          -- workers claim with FOR UPDATE SKIP LOCKED
rate_limits(key text, window_start timestamptz, count int, PK(key, window_start))
funnel_events(id bigserial, session_id uuid, event /*step_view|step_complete|hold_created|payment_started|confirmed|abandoned*/,
              step, booking_id NULL, at DEFAULT now(), utm_source NULL)   INDEX(at); INDEX(session_id)
admin_audit_log(id bigserial, user_id, action, entity, entity_id, diff jsonb, at)
cron_runs(id bigserial, started_at, finished_at, processed int, error)
-- Better Auth: user(+role enum owner|staff), session, account, verification, two_factor — generated into db/schema/auth.ts
```

**Relations:** customer 1→n bookings, quotes and leads. Booking 1→n allocations (at most one active), payments, events and outbox rows. Quote 1→0..1 booking. Zone 1→n bookings and city pages. Service n↔n package (via `package_items`). Service n↔n service (via `service_rules`).

---

## 4. Booking state machines

### 4.1 Wizard (client)
A typed reducer with no external library. `?step=` and non-PII selections live in the URL (`path, size, cond, pkg, svc, add, loc, zip, slot`); every step change is a `router.push`, so the back button walks the steps. PII (name, phone, email, address) and the draft token live **only** in `sessionStorage`, never in the URL. On load the wizard rehydrates URL → sessionStorage → server (`getDraft(token)` returns the server's price, hold expiry and status, and the server always wins). `canEnter(step)` requires every earlier step to validate; a deep link to a later step redirects to the first invalid one.

```
Service path:  1 Path → 2 Vehicle → 3 Services → 4 Location → 5 Date/Time (HOLD) → 6 Contact → 7 Review & Pay → 8 Confirmation
Quote path:    1 Path → 2 Vehicle → 3B Custom job (+photos) → 4 Location → 6 Contact → Quote submitted
Quote accept:  /quote/[token] → /book?quote=… → 5 Date/Time (job pre-filled, price locked) → 6 Contact (pre-filled) → 7 → 8
```
Branches:
- Step 3: picking a quote-only service, or a combination longer than the longest business day, offers "Switch to custom quote" and keeps steps 1–2.
- Step 4: an out-of-area address shows a block with "Request a quote anyway", which goes down the quote path with `out_of_area=true`.
- Step 5: changing services after a hold releases it and re-checks the same start time. If it still fits, the slot is re-held silently; otherwise the user returns to step 5 with a notice.
- Step 5: choosing a different slot releases the old hold and creates a new one.
- A countdown banner shows the hold expiry, with one "Need more time?" extension of +5 minutes, capped at 25 minutes total.

Each step fires `step_view` and `step_complete` to Plausible (custom events) and to `funnel_events` via `sendBeacon`. No PII is sent.

### 4.2 Booking status (server; `transition()` is the only writer)
Every transition is a conditional `UPDATE … WHERE id=$1 AND status = ANY($allowedFrom)` plus a `booking_events` row in the same transaction.
```
(none) ──createHold──────────────▶ held             allocation active, hold_expires_at = now()+holdMinutes (10)
held ──attachContact─────────────▶ held             customer upserted; lead if consented
held ──startPayment (deposit on)─▶ pending_payment  hold_expires_at = now()+paymentHoldMinutes (15); Checkout Session (expires_at ≥ 30 min)
held ──confirmNoDeposit──────────▶ confirmed        hold_expires_at = null
pending_payment ──webhook paid───▶ confirmed        idempotent; second paid deposit ⇒ auto-refund
pending_payment ──payment failed─▶ pending_payment  retry allowed (same or new session)
held|pending_payment ──sweep─────▶ expired          allocation inactive; outbox: stripe.expire_session; lead → booking_abandoned
expired ──late webhook paid──────▶ confirmed  IF the same period can be re-allocated on any eligible resource
                                 ▶ expired    ELSE auto-refund + apology (email/SMS) + owner alert + lead flagged
confirmed ──reschedule───────────▶ confirmed        allocation period updated in place (atomic swap)
confirmed ──cancel───────────────▶ cancelled        allocation inactive; refund/fee per policy (§5.4)
confirmed ──start (admin)────────▶ in_progress
in_progress ──complete (admin)───▶ completed        review request scheduled
confirmed|in_progress ──no-show──▶ no_show          only after starts_at; deposit retained
terminal: completed, cancelled, no_show, expired (except the late-payment rule above)
```

### 4.3 Quote status
`new → quoted` (owner sets price, duration and optional deposit/expiry; the token is emailed/texted). `quoted → quoted` (a revision rotates the token and invalidates the old link). `quoted → accepted` when a booking created from the token reaches `confirmed`. `quoted → declined` (customer or owner). `quoted → expired` (cron after `quote_expires_at`). `new → declined` (spam or not serviceable).

### 4.4 Error states
| Code | Where | Customer sees | System does |
|---|---|---|---|
| VALIDATION | any step | Inline errors plus an error summary (`role="alert"`, `aria-invalid`, `aria-describedby`); can't advance | — |
| QUOTE_ONLY_SELECTED | 3 | Why it needs a quote, with a "Switch to quote" button that keeps data | — |
| RULE_CONFLICT / PREREQ_ADDED | 3 | Which items conflict and why / "We added Paint decontamination because ceramic coating requires it" | Rules engine (§5.1) |
| TOO_LONG_FOR_DAY | 3/5 | Needs custom scheduling → quote path | — |
| OUT_OF_AREA | 4 | Friendly block, "Request a quote anyway", call/text buttons | Quote with `out_of_area` |
| ADDRESS_UNVERIFIED | 4 | Manual address form; zone resolved by ZIP | Places unavailable or no match |
| LOCATION_TYPE_UNAVAILABLE | 4 | "This service is in-shop only" (or mobile only) | — |
| NO_AVAILABILITY | 5 | Next available date, plus contact/quote CTA | Funnel event |
| SLOT_TAKEN | 5 | "Someone just booked that time" plus the 3 nearest alternatives | 23P01 caught |
| HOLD_EXPIRED | 6/7 | Banner; back to step 5 with selections kept and the old slot pre-selected if still free | — |
| CAPTCHA_FAILED / RATE_LIMITED | 6, forms | Retry / "Too many attempts, try again in N min" plus phone CTA | Logged |
| PRICE_CHANGED | 7 | Diff of the old and new price; must re-confirm | Server recompute ≠ snapshot |
| PAYMENT_DECLINED / AUTH_FAILED | 7 | Stripe's message; retry or use another card | Booking stays `pending_payment` |
| CONFIRMATION_DELAYED | 8 | "Payment received — confirming…", polling up to 60s, then an "email on its way" message | Webhook still pending |
| LATE_PAYMENT_SLOT_LOST | system | Apology email/SMS with a refund notice and rebooking link | Auto-refund, owner alert |
| WEBHOOK_INVALID_SIGNATURE | system | — | HTTP 400, no state change, logged |
| PROVIDER_DOWN | system | — | Outbox retries (1m, 5m, 15m, 1h, 6h); admin health panel shows failures |
| MANAGE_TOKEN_INVALID | manage | "Link invalid or expired" plus contact options | Generic response (no oracle) |
| RESCHEDULE_NOT_ALLOWED / LATE_CANCEL | manage | Policy explained; the fee is shown *before* confirming | — |

---

## 5. Algorithms

### 5.1 Pricing engine (pure, `lib/domain/pricing.ts`)
```
price(selection, catalog, settings, zone?, promo?, quote?) → { lines[], notes[], errors[], route: 'book'|'quote', totals, durationMin }
  if quote: lines = [quote.price], duration = quote.duration                       // locked quote price
  items = expand(package.items ∪ services ∪ addons)
  closure: repeat add requires-targets not present (note "auto-added: <reason>") until fixed point
  dedupe: a service included in the chosen package is removed as a separate line (note)
  excludes: any pair present ⇒ errors[] (with reason) — cannot advance
  any quote_only item, or duration > longestBusinessDay ⇒ route = 'quote'
  unit(item, size)     = override(item,size).price  ?? roundTo(item.base × size.priceMultiplier, settings.priceRoundingCents)
  duration(item, size) = override(item,size).minutes ?? ceil(item.baseMin × size.durationMultiplier)
  subtotal  = Σ unit (package priced as one line; its included services at 0)
  surcharge = Σ conditions: flat ⇒ value; percent ⇒ round(subtotal × value/100)
  travel    = location=mobile ? zone.travelFeeCents : 0
  discount  = promo ? min(subtotal, percent ⇒ round(subtotal × v/100) | fixed ⇒ v) : 0   // never discounts travel
  tax       = round((subtotal + surcharge − discount + (settings.taxTravel ? travel : 0)) × taxRateBps/10000)
  total     = subtotal + surcharge + travel − discount + tax
  deposit   = none ⇒ 0 | fixed ⇒ min(v, total) | percent ⇒ round(total × v/100);  balance = total − deposit
  durationMin = roundUp15(Σ duration + Σ condition.extraMinutes)
```
Integer cents, half-up rounding, deterministic. The server always recomputes this from `selection` and never reads client totals.

### 5.2 Availability (`lib/domain/availability.ts`, Temporal)
```
getAvailability({fromDate, toDate, durationMin, locationType, zone}, now):
  s = settings(); tz = s.timezone
  needType = locationType == 'mobile' ? 'mobile_crew' : 'shop_bay'
  travel   = locationType == 'mobile' ? zone.travelMinutes : 0
  R = activeResources(needType);  if R empty → []
  earliest = now + s.minLeadHours;  lastDate = today(tz) + s.maxDaysAhead
  A = allocations(R, overlapping [fromDate−1d, toDate+1d] in tz)
      where active AND (hold_expires_at IS NULL OR hold_expires_at > now)   // expired holds ignored
  for date in fromDate..toDate (Temporal.PlainDate):
    if date > lastDate or blackout(date) or hours(date.dayOfWeek) is empty: continue
    for iv in hours(date.dayOfWeek):                                  // e.g. 08:00–12:00, 13:00–17:00
      closeI = zoned(date, iv.closes, tz, 'earlier').toInstant()
      openI  = zoned(date, iv.opens,  tz, 'later').toInstant()
      for wall = iv.opens; wall < iv.closes; wall += s.slotIntervalMin (PlainTime arithmetic, local wall clock):
        start = zoned(date, wall, tz, 'reject')  → skip if nonexistent (spring-forward gap)
        // fall-back: each wall time is visited once and 'earlier' wins, so the repeated hour can't produce duplicates
        end = start + durationMin (exact elapsed minutes)
        if start < earliest or end > closeI: continue
        if s.travelCountsAgainstHours and start − travel < openI: continue
        blocked = [start − travel, end + s.bufferMin)
        free = R.filter(r → no a ∈ A[r] overlaps blocked)
        if free.nonEmpty: emit {start (UTC ISO), label: Intl format in tz, capacity: free.size}
  return days with ≥1 slot (the calendar disables the rest)
```
Partial-day closures and crew time-off are `kind='block'` allocations, so they're handled with no special cases. Cost is days × slots × resources × allocations, all small; per-resource allocation lists are sorted and checked with two pointers.

### 5.3 Hold acquisition (`createHold`, READ COMMITTED)
```
BEGIN
  recompute price/duration from selection; recompute blocked range; re-run the slot rules for this exact start
  UPDATE resource_allocations SET active=false
   WHERE active AND hold_expires_at < now() AND resource_id = ANY($R) AND period && $blocked
   RETURNING booking_id   → mark those bookings expired, enqueue stripe.expire_session + abandoned-lead updates
  INSERT INTO bookings(status='held', idempotency_key=$k, …) ON CONFLICT (idempotency_key) DO NOTHING
     → if conflict: return the existing hold (a double-click or network retry is idempotent)
  for r in R ordered by (load that day asc, sort):
     SAVEPOINT a; INSERT resource_allocations(r, $blocked, active, hold_expires_at=now()+hold)
     on SQLSTATE 23P01 → ROLLBACK TO a; continue;   else break
  none inserted → ROLLBACK; return {error:'SLOT_TAKEN', alternatives: nearestSlots(start, 3)}
COMMIT; return {bookingId, manageToken (shown once; only its SHA-256 is stored), holdExpiresAt}
```
The exclusion constraint does the real work. When two transactions insert overlapping periods on the same resource, Postgres makes the second wait for the first to commit, then raises 23P01. With N crews, N customers can take the same start time and customer N+1 gets SLOT_TAKEN. After commit, `after()` processes the just-enqueued outbox rows immediately; cron is only the backstop.

### 5.4 Reschedule, cancel, late payment
- **Reschedule:** lock the booking `FOR UPDATE`, check policy (`now ≤ start − minHoursBefore` and `count < maxCount`; admin bypasses both), then `UPDATE resource_allocations SET period=$new, resource_id=$r` on the booking's single active row, trying other resources on 23P01. The old slot is freed in the same statement. Outbox: cancel pending reminders (dedupe keys include `starts_at`), schedule new ones, notify customer and owner, update the calendar sync.
- **Cancel:** `hoursBefore = start − now`. If `hoursBefore ≥ windowHours`, that's *outside the window*: full deposit refund. Otherwise it's a *late cancel* and the fee depends on `lateFee.type`: `forfeit_deposit`, then refund 0; `fixed`, then fee = min(value, depositPaid); `percent`, then fee = min(round(total × v%), depositPaid). Refund = depositPaid − fee. Exactly at the boundary counts as outside. The refund goes through the outbox (`stripe.refund`, idempotency key `refund:<bookingId>:cancel`). If no deposit was taken, a late fee is *recorded as owed*, not charged (there's no card on file). Admin cancellations default to a full refund with an override.
- **Late payment:** handled per §4.2.

### 5.5 Notifications (outbox)
On confirm: customer email + SMS (if consented), owner email + SMS. Reminders at `start − 24h` and `start − 2h` are skipped if already in the past. SMS respects quiet hours (default 21:00–08:00 business time). A 2-hour reminder that falls inside quiet hours moves to the end of quiet hours, or becomes email-only if that would land within 30 minutes of the start. A review request goes out at `completed_at + reviewDelayH`. Cancel or reschedule cancels pending rows by dedupe key. Every send runs from the outbox with retries; SMS is skipped if `sms_opt_out_at` is set.

---

## 6. Animation plan

**Global rules**
- Only `transform` and `opacity` are animated, enforced by the `lib/motion/tween.ts` wrapper, which throws in dev and tests on layout properties.
- All motion lives in `useGSAP` scopes with `gsap.matchMedia()` contexts: `desktop = (min-width:768px) and (prefers-reduced-motion:no-preference)`, `mobile = (max-width:767px) and (prefers-reduced-motion:no-preference)`, `reduced = (prefers-reduced-motion:reduce)`.
- GSAP loads by dynamic import after hydration plus `requestIdleCallback`. Content is never hidden on the server. Below-the-fold elements only get the pre-reveal state once `html.motion-ready` is set, and that class is removed if GSAP hasn't loaded within 3s, so content can't get stuck invisible.
- Lenis runs on marketing routes only. `/book`, `/booking/*` and `/admin` use native scroll (forms, dialogs, bottom sheet).
- **Route transitions:** each page wraps its content in `<ViewTransition>` with a ~350ms opacity cross-fade. The header stays anchored (`view-transition-name: site-header`, animation none). Service card → service hero is a shared-element morph (`name="service-<slug>"`, `share="morph"`, `default="none"`). Wizard steps use `addTransitionType('step-forward' | 'step-back')` for a 12px slide plus fade.
- **Fallback** when `document.startViewTransition` is missing: `template.tsx` applies a CSS opacity fade-in (300ms) under `@supports not (view-transition-name: none)`.
- **Reduced motion:** view-transition durations go to 0, except a 150ms opacity fade.

| Page / section | Desktop | Mobile (<768px) | Reduced motion |
|---|---|---|---|
| Home 1 — Hero | LCP = optimised poster (`priority`, `fetchPriority=high`, AVIF), rendered from the same model and camera as 3D frame 0. Headline animates in CSS with transform only, so it paints on frame 1 (SplitText is never used on the LCP text). The canvas loads after `load` + idle or on first interaction, if capability checks pass, then cross-fades over the poster. **Pinned ~150vh scrub:** car rotates ~200°, camera orbits on a spherical path, and a **light sweep** moves a `Lightformer` softbox across the procedural environment so the highlight travels over the clear-coat. CTAs fade in. | No pin. The canvas loads on first interaction only, DPR ≤ 1.5, a short scrub while the hero is in view, `frameloop="demand"` with `invalidate()` on progress. | Poster only, no canvas, no pin. |
| 3D fallbacks (all) | Low-power (`hardwareConcurrency ≤ 4` with `deviceMemory ≤ 4`, `saveData`, 2g/3g, `prefers-reduced-data`), WebGL2 context failure, error-boundary catch, or a runtime FPS guard (60-frame average > 50ms) all fall back to the poster. Rendering pauses off-screen via IntersectionObserver. `renderer.compileAsync` avoids long tasks. Geometries, materials and textures are disposed on unmount. | Same | Poster |
| 2 — Trust bar | Count-up (0 → value) on enter; the final value is server-rendered; `tabular-nums` and fixed `ch` width keep CLS at 0 | Same, shorter | Static values |
| 3 — Services overview | `ScrollTrigger.batch` stagger: y 24→0, opacity; hover scales the card 1.02 and zooms the image | y 12, no hover | Opacity only |
| 4 — Packages & pricing | Size toggle (RadioGroup) cross-fades price numerals (keyed); featured tier lifts slightly on enter | Same | Instant swap |
| 5 — Before/after | Transform-only slider (after-layer `translateX` + counter-translated image; no clip-path animation); native range input underneath for keyboard and screen readers; one-time "peek" 50→58→50% when in view | Touch drag, larger handle (48px) | No peek |
| 6 — How it works | Pinned short sequence; progress line `scaleX` scrub; steps reveal in turn | Vertical list, no pin, simple reveals | Static |
| 7 — Why choose us | SplitText line-mask reveal on the headline (`autoSplit`, `mask:'lines'`, built-in aria); image parallax (yPercent ±8, scrub) | No parallax; line reveal kept | Static |
| 8 — Reviews | CSS scroll-snap carousel with prev/next buttons; **no autoplay** (WCAG 2.2.2); cards fade in | Swipe (native) | Static |
| 9 — Service area | ZIP checker; result fades in; stylised SVG area list (no map SDK) | Same | Instant |
| 10 — Memberships (flag) | Fade-up | Same | Static |
| 11 — FAQ preview | Radix Accordion with opacity on content (no height animation) | Same | Instant |
| 12 — Final CTA | Sheen sweep on a pseudo-element (`translateX`), button press scale 0.98 | Same | Static |
| `/services` | Card stagger; card image is the morph source | Simpler stagger | Opacity |
| `/services/[slug]` | Hero is the morph target; section reveals; gallery parallax | No parallax | Opacity |
| `/gallery` | Grid fade-in; lightbox (Radix Dialog) scale 0.96→1 + opacity | Same | Opacity |
| `/about` | SplitText headline; image parallax | No parallax | Static |
| `/reviews`, `/faq`, `/contact`, legal, `/areas/*` | Simple fades only | Same | None |
| `/book` | Step slide + fade via ViewTransition types; summary total cross-fade; bottom sheet slides up (transform) | Same | Instant |
| `/booking/[token]` | Fade | Same | None |
| `/admin` | No decorative motion; drag uses transforms | — | — |
| 404 | Small car glyph drives in (transform) | Same | Static |

**3D asset rules.** gltf-transform runs `optimize --compress meshopt --texture-compress ktx2`, pruning and resizing textures to ≤ 2K. The target is ≤ 1.5 MB with a hard CI limit of 2 MB. No manufacturer badge. `public/models/LICENSE.txt` is required. The placeholder model is Khronos **ToyCar (CC0 1.0, license verified)**, marked as a placeholder and listed in §16. CarConcept was rejected because it's CC-BY, which falls outside your CC0-or-purchased rule.

---

## 7. Performance budget

| Item | Budget | How it's met | Enforced by |
|---|---|---|---|
| Lighthouse Performance | ≥ 90 mobile, ≥ 95 desktop on `/`, `/services/ceramic-coating`, `/book` | Everything below | LHCI assertions (3 runs, median) |
| LCP | < 2.5s (target < 2.0s lab) | Static HTML from the CDN; poster AVIF ~60–90 KB at mobile width; `priority` preload; no render-blocking third parties; fonts preloaded | LHCI + RUM |
| CLS | < 0.1 (target < 0.02) | Dimensions on every media element; `adjustFontFallback`; canvas overlays a fixed-size poster box; space reserved for the sticky bar; no injected banners above content | LHCI + RUM |
| INP | < 200ms (lab proxy TBT < 200ms) | Small client islands; GSAP/3D off the critical path; RHF uncontrolled inputs; 3D `frameloop="demand"` and `compileAsync` | LHCI TBT + Playwright `web-vitals` INP under 4× CPU throttle + RUM |
| Initial JS, mobile Home | ≤ 170 KB gzip | Estimate: Next + React runtime ~100–105 KB, header/sticky bar/size toggle/slider/ZIP checker ~15–25 KB. Lenis, GSAP (~50 KB) and Three/R3F (~200 KB+) all load after `load` | `scripts/check-bundle.ts` (Playwright sums encoded JS bytes until the `load` event on mobile emulation) |
| 3D payload | Model ≤ 2 MB (target 1.5) | Meshopt + KTX2, procedural env map (0 bytes) | File-size test in CI |
| Rendering mode | Marketing static; only booking/manage/quote/admin dynamic | `ensureStatic='navigation'` on the marketing layout fails the build if violated | `next build` + route manifest test |
| Fonts | ≤ 2 families, Archivo optional, preloaded | next/font, variable, latin subset | Network test counts font families |
| Images | Correct `sizes`; lazy below the fold; hero eager | next/image AVIF/WebP | Playwright checks `loading` and `fetchpriority` |
| Third parties | Plausible ~1 KB deferred; Turnstile only on form steps; Stripe.js only on step 7; Places only on step 4 focus; map iframe only on click (facade) | | Network assertions per route |

**Risk:** 170 KB is tight because the framework baseline takes ~100 KB. If we go over, trim client islands first and push them to deferred islands.

---

## 8. Third-party services and env vars
Env is parsed by `lib/env.ts` (Zod) at boot. Production refuses to start with fake drivers. `.env.example` lists every variable, and a test asserts the two stay in sync.

| Service | Vars | Used for | If missing |
|---|---|---|---|
| Postgres | `DATABASE_URL` | Everything | Hard fail at boot/build with a clear message |
| Site | `NEXT_PUBLIC_SITE_URL`, `TOKEN_PEPPER` | Canonicals, links, token hashing | Hard fail |
| Admin auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (+ `pnpm admin:create` for the first owner) | Admin login | Admin disabled; prod hard fail |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Deposits, refunds | Deposit forced to "pay at appointment", admin warning banner, launch check fails if a deposit is configured |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_NOTIFY_EMAIL` | Email | Outbox rows marked `skipped` and logged (dev); launch check fails (prod) |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `OWNER_NOTIFY_PHONE` | SMS | SMS skipped; the consent checkbox is hidden (we don't collect consent we can't use) |
| Turnstile | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Bot protection | Dev uses Cloudflare's official test keys. Prod: launch check fails; runtime falls back to rate limit + honeypot and logs a warning |
| Google Places | `GOOGLE_MAPS_SERVER_KEY` (Places API New + Geocoding, IP-restricted) | Autocomplete, lat/lng for radius zones | Manual address form with zone by ZIP only; radius rings unavailable |
| Google Maps Embed | `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` (referrer-restricted) | Click-to-load map on contact/in-shop | Address text + "Open in Google Maps" link |
| R2 | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` | Quote photos, admin media | Photo upload hidden (text description only); dev/test use `STORAGE_DRIVER=local` |
| Cron | `CRON_SECRET` | `/api/cron/tick` | Endpoint returns 503; holds still expire lazily; reminders don't send; launch check fails |
| Plausible | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (+ optional `NEXT_PUBLIC_PLAUSIBLE_SRC`) | Analytics, RUM | No analytics; the server-side funnel still feeds admin metrics |
| GA4 / Meta / Google Ads (optional) | `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GADS_ID` | Ads attribution | Not loaded. If present, a consent banner appears (Consent Mode v2, default denied) and tags load only after opt-in |
| Google Calendar (flag) | `GCAL_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GCAL_CALENDAR_ID` | One-way sync to the owner's calendar | Sync off |
| Test-only drivers | `PAYMENTS_DRIVER=stripe\|fake`, `NOTIFY_DRIVER=live\|capture`, `STORAGE_DRIVER=r2\|local`, `CAPTCHA_DRIVER=turnstile\|test`, `TEST_CLOCK=1` | Deterministic tests | Defaults to live. Fakes and the clock are refused when `NODE_ENV=production` or `VERCEL_ENV=production` |

---

## 9. Security, privacy, SEO, accessibility

**Security**
- Zod on every Server Action and route handler, using schemas shared with the client.
- Server Actions get Next's origin check; route-handler POSTs verify `Origin`. Admin cookies are `__Host-`, Secure, HttpOnly, SameSite=Lax.
- Postgres rate limits:
  - availability: 60/min/IP
  - holds: 10 per 10 min per IP
  - forms: 5/hour/IP
  - upload signing: 30/hour per session
  - manage-link actions: 10/hour/token
  - admin login: 5 per 15 min per IP+email (on top of Better Auth's own limits)
- Turnstile is verified server-side (`siteverify` with action + hostname, single use).
- Stripe webhook: raw body + `constructEvent`; deduped by event id; amount, currency and metadata are checked against the booking. Twilio webhooks are signature-verified.
- Manage and quote tokens are 32 random bytes (base64url). Only `SHA-256(token + pepper)` is stored. Manage tokens expire 30 days after the appointment. Token pages are noindex with `Referrer-Policy: no-referrer`.
- **Headers:**
  - Strict nonce CSP via `proxy.ts` on `/book`, `/booking/*`, `/quote/*`, `/admin/*`: `script-src 'nonce-…' 'strict-dynamic'`, with Stripe, Turnstile and Plausible allowed.
  - Allowlist CSP on static pages, with no `unsafe-eval`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`.
  - HSTS (2y, includeSubDomains; preload left opt-in), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`.
- **Admin:** `proxy.ts` redirects as a fast path only. Every admin page, Server Action and route handler calls `requireAdmin(role)` in the data-access layer, since the proxy alone is never trusted. Staff can't refund, export or change settings. TOTP 2FA is enforced for the owner.
- **Uploads:** image/jpeg, png, webp and heic only. Max 10 files, ≤ 15 MB raw and ≤ 2 MB after client compression. Keys are random. The bucket is private and admin views via short-lived signed GETs. After upload the server checks size and type with a HEAD request and magic bytes with a 16-byte ranged GET. Canvas re-encoding strips EXIF/GPS; HEIC that the browser can't decode is uploaded as-is and noted.
- CSV export neutralises formula injection (`= + - @` prefixed with `'`).
- `server-only` imports are used throughout, and `NEXT_PUBLIC_` variables are audited. Logs redact PII.

**Privacy.** Admin can export or anonymise a customer. Abandoned leads are purged after 12 months (configurable). The privacy policy template lists every processor.

**SEO**
- `generateMetadata` gives every page a unique title and description, plus OG/Twitter images via `next/og` per segment.
- **JSON-LD:**
  - `AutoWash` (a subtype of LocalBusiness/AutomotiveBusiness) with hours, `areaServed`, and the address hidden for mobile-only businesses.
  - `AggregateRating` only if real numbers are configured. Google won't show stars for self-serving LocalBusiness reviews; that's noted, not faked.
  - `Service` per service page, `FAQPage`, `BreadcrumbList`.
- `sitemap.xml` covers all static and published city pages. `robots.txt` disallows `/admin`, `/api`, `/book`, `/booking`, `/quote/`. Canonicals are absolute. Exactly one H1 per page.

**Accessibility (WCAG 2.2 AA)**
- Keyboard: the whole wizard is operable by keyboard, with the step heading focused on step change, a progress bar with text ("Step 3 of 7"), the calendar via react-day-picker, and slots as a RadioGroup.
- Live regions: errors use `aria-live`; the price total uses polite announcements, debounced; the hold countdown is announced only at 2 and 1 minutes.
- The bottom sheet is a focus-trapped dialog. Visible focus uses `:focus-visible` rings at ≥ 3:1. Contrast is 4.5:1, enforced in the design tokens.
- Tap targets are ≥ 44px (`min-h-11`).
- **2.4.11 Focus Not Obscured:** `scroll-padding` accounts for the sticky header and bottom bar.
- **2.5.7 Dragging:** the slider and admin calendar both have click and keyboard alternatives.
- **3.3.7 Redundant Entry:** quote → booking is pre-filled.
- **3.3.8 Accessible Authentication:** paste and password managers are allowed.
- `lang` is set, alt text is required in admin media forms, and there's no autoplay.

---

## 10. Added by Claude (not in the brief — why each is needed)
1. **Operational settings in the DB, seeded from config.** This resolves the §0/§6 contradiction per your answer.
2. **`expired` status + `resource_allocations` table.** Holds, bookings and owner time-blocks share one DB-level exclusion constraint, and a lapsed hold needs a terminal state distinct from cancelled.
3. **Late-payment handling.** A payment can succeed after its hold lapsed (3-D Secure delay, a slow tab). We re-allocate or auto-refund and notify; without this, scenarios 7 and 8 can leave paid-but-unbooked customers.
4. **Quote path collects location + contact before submitting.** The brief's step order would create quote requests with no way to reply and no service-area check.
5. **Over-long jobs → quote path** (your answer), plus admin time blocks for scheduling multi-day work.
6. **Google Places (server-proxied) with a ZIP fallback.** Autocomplete and radius zones need a geo provider; the brief names none.
7. **Admin time blocks** (crew off, equipment down) so the owner never has to fake a booking to block time.
8. **Promo codes.** Required to honour the exit-intent "first-detail discount" securely on the server.
9. **Content admin** (testimonials, gallery, FAQs, city pages) so the owner can replace placeholders with real content without a developer.
10. **`pnpm launch-check`.** Fails while any placeholder remains: business.ts markers, sample reviews/gallery/stats, missing production keys, the model license, or legal-review flags. It enforces your "never ship placeholders that look real" rule.
11. **Admin health panel + owner alerts** for failed outbox items, webhook errors, a stale cron, and late-payment refunds.
12. **SMS compliance:** STOP/HELP handling, a consent audit trail (text version, time, IP), quiet hours, and Twilio toll-free/10DLC setup steps in the README.
13. **Sales-tax setting** (default 0%; varies by state).
14. **CSV formula-injection protection, customer anonymise/export, and lead retention.**
15. **`/accessibility` statement page.**
16. **Owner/staff roles + TOTP 2FA** for a dashboard holding PII that can issue refunds.
17. **`/api/health`** for uptime monitoring and the Docker healthcheck.
18. **`funnel_events`.** "Conversion by step" in admin needs first-party data independent of Plausible.
19. **Fake provider drivers + test clock**, refused in production. They make hold expiry, reminders, DST and webhooks deterministic to test.
20. **Native scroll (no Lenis) on booking, manage and admin**, for form and dialog reliability and accessibility.
21. **Split CSP strategy.** Next can't nonce static pages, so we document it and protect the payment and admin routes strictly.
22. **Map facade.** Map iframes load on click only; that saves ~500 KB and avoids third-party cookies.
23. **City-page uniqueness guard.** Only published city pages with their own content are generated, avoiding Google's doorway-page penalty.
24. **Supply-chain policy:** pnpm release-age gate and blocked install scripts.
25. **README ops notes:** email DNS (SPF/DKIM/DMARC), Apple Pay domain verification, DB backups/PITR, and the Drizzle 1.0 upgrade.
26. **One extension of the hold countdown**, so slow typers on step 6 don't lose their slot.
27. **Duplicate-deposit guard.** A second paid deposit (two tabs) is auto-refunded via a partial unique index.

---

## 11. Scenario walk-through (brief §9, on paper)

| # | Path through §4–§5 | Supported by | Plan changes it forced |
|---|---|---|---|
| 1 | path → sedan → package + 2 add-ons (`price()` lines) → mobile address in zone (travel fee) → `createHold` → contact (customer, lead) → `startPayment` (`pending_payment`, Checkout Session) → webhook → `confirmed` → outbox: customer + owner email/SMS → admin list | bookings, allocations, payments, outbox | — |
| 2 | Same with SUV/truck: `price()` uses the size override or multiplier, and duration uses the duration multiplier. Snapshot, summary, Stripe amount, emails and admin all read `price_snapshot` | `price_snapshot` single source | Store the snapshot rather than recomputing for display |
| 3 | Location = shop → resource type `shop_bay`, travel 0, shop address and map facade | `resources.type` | Resources typed by mobile vs shop |
| 4 | Places → lat/lng/ZIP → no zone match → OUT_OF_AREA → quote with `out_of_area` | `service_zones`, `quote_requests.out_of_area` | Quote path needs location + contact (#10.4) |
| 5 | Quote path → photos (`quote_photos`, signed PUT) → `quote_requests(new)` + lead + owner alert → admin prices it (`quoted`, token) → `/quote/[token]` → `/book?quote=` step 5 → hold → contact pre-filled → pay → `confirmed` → quote `accepted` | `quote_requests.booking_id`, token hash | Price lock via `quote` arg in `price()` |
| 6 | Two `createHold` calls at once → exclusion constraint → one gets 23P01 → SLOT_TAKEN + alternatives | `no_double_booking` | Savepoint loop over resources |
| 7 | Hold lapses → ignored by availability immediately; swept by cron or the next conflicting `createHold` → `expired` → slot shown again | `hold_expires_at`, sweep | Lazy expiry in availability, so correctness doesn't depend on cron |
| 8 | Declined → stays `pending_payment`, retry. 3DS → `/book/return` → poll. Tab closed → hold lapses → `expired`, abandoned lead. Paid after lapse → §4.2 rule | payments.attempt, late-payment rule | #10.3 |
| 9 | Same `event.id` twice → `webhook_events` PK conflict → no-op. Distinct events for the same session → conditional `UPDATE … WHERE status='pending_payment'` affects 0 rows | `webhook_events`, conditional transition, `one_paid_deposit` | — |
| 10 | Refresh: URL + sessionStorage + `getDraft`. Back: history entries per step | Wizard §4.1 | PII never in the URL |
| 11 | Manage link → availability for the booking's duration → atomic allocation update → old slot free → outbox reschedules reminders + notifications | One active allocation per booking | Dedupe keys include `starts_at` |
| 12 | Cancel ≥ window → full refund; < window → fee per `lateFee`; Stripe refund via outbox | §5.4 | Boundary is inclusive-outside |
| 13 | Blackout and closed days skipped; DST: wall-clock iteration + `'reject'`/`'earlier'` disambiguation | §5.2 | Labels computed in tz; no "+24h in UTC" arithmetic |
| 14 | `end > closeI` → no slot; longer than any day → quote | §5.2, §5.1 | — |
| 15 | Zod per step + server re-validation | Shared schemas | — |
| 16 | `deposit.mode = none` → step 7 shows "pay at appointment" → `confirmNoDeposit` | §4.2 | — |
| 17 | Every control reachable and operable by keyboard; focus management on step change | §9 a11y | Focus the step heading |

The schema and state machines handle all 17 scenarios with the changes noted above.

---

## 12. Test plan (every requirement → at least one automated test)

Test IDs appear in test titles. `scripts/verification-report.ts` turns the Vitest and Playwright JSON reporters into `/docs/VERIFICATION.md`, listing requirement → test → pass/fail.

**Unit (Vitest)**
- **U-PRICE:** every package/service/add-on × all 4 sizes (exhaustive over the seed catalog); overrides vs multipliers; rounding; conditions flat/percent; travel; promo percent/fixed, capped, never on travel; tax on/off travel; deposit none/fixed/percent; duration rounding; quote price lock; tampered client totals ignored.
- **U-RULES:** requires closure with reasons; excludes errors; package-included dedupe; quote-only routing; too-long-for-day routing.
- **U-AVAIL:**
  - hours with multiple intervals; closed weekday; blackout; lead time; max days ahead
  - capacity 1/2/3; buffer; zone travel with `travelCountsAgainstHours` on and off; blocks; active vs expired holds
  - duration exceeding remaining hours; slot interval
  - DST spring forward (America/New_York, 2027-03-14) and fall back (2026-11-01) with a synthetic 24h schedule; Pacific/Honolulu (no DST)
  - labels in the business timezone
- **U-POLICY:** cancellation inside/outside/exact boundary × fee types × deposit on/off; reschedule limits; admin overrides.
- **U-STATE:** full allowed/forbidden transition matrix for bookings and quotes; wizard `canEnter`.
- **U-VALID:** each step schema (bad phone, bad email, empty required, ZIP, year range, max 10 photos); client/server schema identity.
- **U-ZONE** (ZIP, radius rings, precedence), **U-TOKEN** (hashing, constant-time lookup, expiry), **U-ICS** (RFC 5545 escaping, UTC/TZID, folding), **U-CSV** (formula injection, quoting), **U-RATE** (window math), **U-CSP** (header builder), **U-MOTION-GUARD** (tween wrapper rejects layout properties), **U-CONFIG** (business.ts schema; placeholder list equals the README "Values to fill in"), **U-ENV** (env schema keys equal `.env.example`), **U-FLAGS**.

**Integration (Vitest + embedded Postgres, real concurrent connections)**
- **I-DB-EXCL:** 20 rounds of parallel `createHold` on one slot. 1 crew → exactly 1 succeeds; 2 crews → 2 succeed and the 3rd fails. A block vs hold overlap is rejected. Direct SQL insert of overlapping active allocations raises 23P01.
- **I-HOLD-EXPIRE:** expired hold invisible to availability; swept in-transaction; `stripe.expire_session` enqueued.
- **I-WEBHOOK:** duplicate event; out-of-order events; second paid deposit → refund task; bad signature → 400; amount mismatch → rejected and alerted.
- **I-LATE-PAY:** re-allocate success path and refund path.
- **I-RESCHEDULE / I-CANCEL:** allocation swap; reminders re-keyed; refund amounts passed to the fake Stripe.
- **I-OUTBOX:** confirm notifications to customer and owner; 24h/2h reminders via the test clock; quiet hours; review request; retry/backoff; `SKIP LOCKED` with no double send under two workers.
- **I-LEAD:** abandoned booking with consent → lead, without consent → none; contact/quote → lead + owner notification; UTM/referrer persisted.
- **I-QUOTE:** lifecycle; token rotation; expiry; accept → booking.
- **I-AUTH:** every admin action rejects anonymous and under-privileged sessions.
- **I-CSRF:** cross-origin POST rejected. **I-RATE:** rate limits. **I-CAPTCHA:** Turnstile pass/fail/missing. **I-VALID-SERVER:** malformed payloads straight to actions. **I-UPLOAD:** size/type/magic-byte rejects. **I-METRICS:** seeded funnel → expected conversion numbers. **I-MANAGE-TOKEN:** invalid/expired tokens.

**E2E (Playwright: desktop-chrome, mobile-safari, mobile-chrome)**
- **E2E-01…E2E-17** match brief §9 scenarios 1–17 one-to-one, run on all three projects. E2E-17 runs keyboard-only, with zero `click()` calls.
- **Payment modes.** By default `PAYMENTS_DRIVER=fake` renders a test payment panel (success / decline / 3DS-required / close) that posts Stripe-shaped, signed webhooks through the real webhook handler. The `@stripe-live` tag reruns E2E-01, 08 and 09 against **real Stripe test mode** (test cards 4242…, decline 4000 0000 0000 9995, 3DS 4000 0027 6000 3184 in the Payment Element iframe, with `stripe listen` forwarding). That needs your Stripe test keys; without them the run is reported as *not run*, not passed.
- **E2E-LAYOUT** (header, footer, sticky bar with `tel:`/`sms:`), **E2E-HOME** (12 sections, size toggle live prices, ZIP checker, slider drag + keyboard, carousel buttons, FAQ), **E2E-SERVICE-CTA** (pre-selects the service), **E2E-PRICING**, **E2E-GALLERY** (filter, lightbox, lazy), **E2E-CONTACT**, **E2E-RULES**, **E2E-SUMMARY** (sidebar desktop, bottom sheet mobile), **E2E-UPLOAD-LIMITS** (11th file rejected, oversize, retry after a forced failure, progress bar), **E2E-ICS** (download + Google Calendar link), **E2E-UTM**, **E2E-EXIT-INTENT** (off by default; on → desktop only; never on the mobile projects), **E2E-FLAGS** (gift cards, memberships).
- **Admin:** **E2E-ADMIN-AUTH**, **E2E-ADMIN-CAL** (drag reschedule + conflict refusal + keyboard alternative), **E2E-ADMIN-BOOKINGS** (filters, status, notes, mark paid/completed/no-show), **E2E-ADMIN-CATALOG** (price edit shows up on `/pricing` and in the wizard), **E2E-ADMIN-SETTINGS** (hours, blackout, capacity, zone, deposit and policy changes alter availability and pricing), **E2E-ADMIN-CUSTOMERS**, **E2E-ADMIN-CSV**.
- **Smoke subset** (E2E-01, E2E-LAYOUT, crawl) on desktop-firefox, desktop-webkit and msedge.

**Site checks (Playwright + scripts)**
- **S-CRAWL:** sitemap plus every internal `href` on desktop and mobile navigation; all return 2xx/3xx→2xx. External links are reported only.
- **S-AXE:** every route, each wizard step, error states and admin pages (logged in); no serious or critical violations.
- **S-LHCI:** thresholds from §7 on mobile and desktop presets.
- **S-BUNDLE:** initial JS on Home is ≤ 170 KB gzip; no three/gsap chunk loads before `load`.
- **S-INP:** `web-vitals` INP < 200ms during scripted booking interactions under 4× CPU throttle (Chromium).
- **S-STATIC:** marketing routes are prerendered (route manifest + `ensureStatic`).
- **S-REDUCED:** `reducedMotion:'reduce'` → no Lenis (`html.lenis` absent), no canvas, no pin spacer, VT durations 0; the page stays fully usable.
- **S-WEBGL-OFF:** Chromium with `--disable-webgl --disable-webgl2` → poster, no console errors, no error UI. A forced context loss still falls back to the poster.
- **S-LOWPOWER:** `saveData` / low `hardwareConcurrency` via `addInitScript` → poster.
- **S-3D:** DPR clamp (≤ 1.5 mobile, ≤ 2 desktop); render pauses off-screen (frame counter); disposal returns `renderer.info.memory` to baseline after navigating away; model ≤ 2 MB; license file present.
- **S-MOTION:** after scrolling, reveal targets reach their final transform/opacity; pin spacer only on desktop; counters end at configured values.
- **S-VT:** navigation calls `startViewTransition`; with it deleted, the fallback fade class applies.
- **S-SEO:**
  - unique titles and descriptions
  - OG image routes return images
  - exactly one H1 per page
  - JSON-LD types and fields present per page type
  - canonicals
  - sitemap includes published cities only
  - robots rules
- **S-HEADERS:** CSP (nonce on dynamic routes), HSTS and the rest.
- **S-FOCUS** (visible focus ring), **S-TAP** (interactive boxes ≥ 44px on mobile), **S-FONTS** (≤ 2 families), **S-IMAGES** (hero eager + `fetchpriority=high`; below-the-fold lazy), **S-ERRORS** (styled 404/500).
- **S-PLACEHOLDERS:** placeholders visibly labelled; `launch-check` fails while any remain.

**Manual / out-of-reach (reported honestly in VERIFICATION.md):** real iPhone/Android devices and BrowserStack (not available here; WebKit/Chromium emulation only), and real SMS/email deliverability, which needs your provider accounts.

---

## 13. Build order, repo layout, deployment

**Phase 2 milestones** (conventional commits; each ends green on lint, typecheck and tests):
- **M0 Scaffold.** `git init`; `docs/PLAN.md`; pnpm + Next 16.4 (TS strict, Turbopack, Cache Components); Tailwind 4; `shadcn init -b radix`; ESLint/Prettier; Vitest; Playwright; the embedded-PG harness; GitHub Actions CI (lint, typecheck, unit/integration, e2e, LHCI).
- **M1 Config + DB.** `config/business.ts` (Zod-validated, `PLACEHOLDER()` markers); Drizzle schema; migrations with custom SQL; `db/seed.ts` (catalog, zones, hours, resources, settings, placeholder content); settings loader with cache tags.
- **M2 Domain engines, test-first.** Pricing, rules, availability, policy, time/Temporal utilities, tokens, state transitions, ICS, CSV, zone resolution.
- **M3 Booking backend.** Holds tx, actions, availability route, payment driver (Stripe + fake), webhook, outbox + cron, email templates, SMS, quotes, uploads, leads, rate limiting, Turnstile, Places proxy.
- **M4 Booking UI.** The 8-step wizard + summary/bottom sheet + persistence + a11y; confirmation; `/booking/[token]`; `/quote`, `/quote/[token]`.
- **M5 Marketing site.** Layout, header, footer, sticky bar; all pages; SEO metadata, JSON-LD, sitemap, robots, OG; city pages.
- **M6 Motion + 3D.** Lenis/GSAP provider, section motion, view transitions + fallback, model pipeline, poster render script, capability detection, fallbacks.
- **M7 Admin.** Auth/2FA, calendar, bookings, leads/quotes, catalog, schedule/area/settings, content, customers, metrics, CSV.
- **M8 Hardening + deploy.** CSP/headers, `launch-check`, Dockerfile/compose, `vercel.json` cron, README (setup, env, seeding, tests, deploy, Values to fill in, admin walkthrough).

Then **Phase 3** (§14). M5/M6 and M7 only depend on M1–M2, so I'll decide after approval whether any can run as parallel sessions.

```
app/(marketing)/…  app/book/…  app/booking/[token]/…  app/quote/…  app/admin/(auth)/login  app/admin/(dash)/…  app/api/…
components/{ui,marketing,booking,admin,motion,three}/
config/business.ts
db/{schema/*.ts, migrations/, seed.ts, client.ts}
emails/*.tsx
lib/domain/{pricing,rules,availability,policy,state,time,zones,ics,csv}.ts
lib/server/{actions/,services/,drivers/{payments,notify,storage,captcha}/,auth.ts,rate-limit.ts,outbox.ts}
lib/validation/*.ts   lib/env.ts   lib/motion/
public/models/{car.glb,LICENSE.txt}   public/images/
scripts/{launch-check,check-bundle,optimize-model,render-poster,dev-db,verification-report,admin-create}.ts
tests/{unit,integration,e2e,site}/
docs/{PLAN.md,VERIFICATION.md}
Dockerfile  docker-compose.yml  vercel.json  lighthouserc.cjs  playwright.config.ts  vitest.config.ts  drizzle.config.ts  .env.example  README.md
```

**Deployment**
- **Vercel (primary):** Pro plan (cron `*/5 * * * *` → `/api/cron/tick`); Neon Postgres via the Marketplace (PG 18, PITR); R2; env vars in the dashboard; `pnpm db:migrate` as the build step before `next build`.
- **Docker (DigitalOcean/AWS):**
  - multi-stage `Dockerfile` (`output: 'standalone'`)
  - `docker-compose.yml`: app, postgres:18, and a `scheduler` container that calls `/api/cron/tick` every 5 minutes with `CRON_SECRET`
  - healthcheck on `/api/health`; optional Caddy for TLS
  - migrations run as a one-shot `migrate` service
  - the build needs DB access because cached catalog pages are prerendered (documented)

---

## 14. Verification (Phase 3)
1. `pnpm lint && pnpm typecheck && pnpm test` (unit + integration on embedded Postgres).
2. `pnpm build && pnpm e2e` (all projects, fake drivers + test clock) and `pnpm e2e:stripe` if Stripe test keys are provided.
3. `pnpm site-checks` (crawl, axe, reduced motion, WebGL off, SEO, headers, bundle, INP) and `pnpm lhci` (mobile + desktop on the 3 URLs).
4. Fix every failure, then rerun until green. Nothing is marked done while a test fails.
5. `pnpm verify:report` generates `/docs/VERIFICATION.md`: requirement → test → pass/fail, Lighthouse scores, bundle size, and known limitations.
6. `pnpm launch-check` in report mode, listing the remaining placeholders (expected to fail until §16 is filled in).

---

## 15. Risks and known limitations
- **Initial JS of 170 KB** is tight against a ~100 KB framework baseline. Mitigation: aggressive deferral, measured in CI.
- **Lighthouse mobile ≥ 90 vs 3D.** Lab runs don't interact, so 3D loads on interaction/idle and lab scores won't include its cost for real users. RUM (`web-vitals` → Plausible) covers field data.
- **Static-page CSP needs `'unsafe-inline'` for scripts** (Next limitation). Payment, manage and admin routes get a strict nonce CSP.
- **Tooling flux:** TS 7 has no API (TS6 compat alias); Drizzle 1.0 is pending; the docs disagree on Stripe's `ui_mode` name. Each gets verified at scaffold time.
- **Real Stripe E2E needs your test keys.** Without them, the payment path is verified through the fake driver plus the real webhook handler only.
- **No real devices or BrowserStack here.** Emulation only, reported as a limitation.
- **SMS go-live depends on Twilio registration** (days to weeks), so do it early.
- **R2 lacks POST-policy uploads.** Size is enforced via the signed `Content-Length` plus a post-upload HEAD check.
- **Vercel Hobby can't run 5-minute cron.** Use Pro or an external scheduler; holds stay correct either way (lazy expiry).
- **The placeholder 3D model (ToyCar) doesn't look premium.** A purchased, debadged car model is needed for launch.

---

## 16. Values to fill in (initial list — the README keeps it authoritative)
- **Brand:** business name, tagline, logo (SVG), brand colours, OG image art.
- **Contact:** phone, SMS number, email, shop address (if any), timezone.
- **Operations:**
  - service mode, base address lat/lng
  - zones (ZIPs and/or radius rings) with travel fee and minutes, plus cities for `/areas`
  - hours and holidays/blackouts
  - number of crews and bays
  - deposit, cancellation window and fee, reschedule rules, tax rate
- **Catalog:** real prices, durations, size multipliers/overrides, condition surcharges, rules (seeded with clearly fake placeholder numbers).
- **Proof:** real reviews and rating numbers, "cars detailed" count, insurance and certification proof, products/brands used, team and story, real before/after photos.
- **Links:** socials, Google Business Profile, review link, gift-card Payment Link (if enabled).
- **3D:** a licensed (CC0 or purchased), debadged car model + LICENSE.txt; the hero poster is rendered from it by script.
- **Legal:** privacy, terms and cancellation text reviewed by a lawyer; TCPA SMS consent wording reviewed.
- **Accounts/keys:** Stripe, Resend (+ DNS), Twilio (+ toll-free verification), Cloudflare (Turnstile, R2), Google Maps Platform, Plausible, Neon/hosting, optional GA4/Meta/Ads/Google Calendar.

---

## Sources (research, 2026-10-22)
- npm registry `latest` dist-tags and publish times for every package in §1 (queried via `npm view`).
- Next.js 16.4 release — https://nextjs.org/blog/next-16-4
- Next.js view transitions guide — https://nextjs.org/docs/app/guides/view-transitions
- React 19.3 (stable ViewTransition) — https://react.dev/blog/2026/09/09/react-19-3 · https://react.dev/reference/react/ViewTransition
- Next.js CSP guide (nonces require dynamic rendering) — https://nextjs.org/docs/app/guides/content-security-policy
- TypeScript 7.0 (no API; TS6 compat package) — https://devblogs.microsoft.com/typescript/?p=5246 · Next 16.3 + TS 7 — https://nextjs.org/docs/app/api-reference/config/typescript
- Auth.js joins Better Auth — https://www.better-auth.com/blog/authjs-joins-better-auth
- Vercel cron limits — https://vercel.com/docs/cron-jobs/usage-and-pricing
- Stripe Checkout Sessions vs Payment Intents — https://docs.stripe.com/payments/checkout-sessions-and-payment-intents-comparison
- Cloudflare R2 S3 API compatibility — https://developers.cloudflare.com/r2/api/s3/api/ · presigned URLs — https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Lenis README (GSAP integration, syncTouch, reduced motion, anchors) — https://cdn.jsdelivr.net/npm/lenis@1.3.27/README.md
- Node.js 26 (Temporal on by default) — https://nodejs.org/en/blog/release/v26.0.0
- shadcn Base UI default (Radix still supported) — https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- Twilio A2P 10DLC / toll-free — https://www.twilio.com/en-us/changelog/new-error-codes-provide-clearer-tfv-and-a2p-10dlc-registration-f · https://pages.twilio.com/10DLC-HelpArticles-WW
- Google Maps Platform pricing — https://developers.google.com/maps/billing-and-pricing/pricing
- Khronos glTF sample model licenses (ToyCar CC0, CarConcept CC-BY) — https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Models-showcase.md
- GSAP 3.15 changes — https://github.com/greensock/GSAP/commit/master
