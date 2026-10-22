# Build Progress — Premium Car Detailing Website

_Last updated: 2026-10-22_

| Phase | Status |
|---|---|
| Phase 1 — Plan | ✅ Done. You approved it; it's committed as `docs/PLAN.md`. |
| Phase 2 — Build | 🟡 About half the code is written. **It has not been compiled or run yet** (see "Blocker"). |
| Phase 3 — Verify | ⬜ Not started. |

## Blocker: the project must move to a short folder path

The project currently lives in a temporary folder whose path is 187 characters long. Windows limits paths to 260 characters, so the native tools can't start from there:

- esbuild's binary sits at a 276-character path.
- Postgres's binaries and timezone files sit even deeper.
- Next's SWC compiler is right at the limit.

None of the code has been typechecked, built or tested yet.

**Next step:** move the project to a short path such as `C:\dev\detailing-site`, then run:

```
pnpm install
pnpm typecheck
pnpm lint
```

Fix whatever compile errors that turns up, then continue with the "Still to do" list below.

## Decisions made

You made these during planning:

- **Settings:** `config/business.ts` provides the default values. The seed copies them into the database, and from then on the admin dashboard owns them.
- **Local database:** embedded Postgres 18, started via the `embedded-postgres` npm package. No Docker needed for development or tests.
- **Travel time:** a fixed number of minutes and a fee per service zone.
- **Jobs longer than one business day:** these go down the quote path.

I made these during the build:

- **pnpm 12 with a supply-chain policy:** releases must be at least 7 days old, publisher trust can't drop, and install scripts are blocked unless allowlisted.
  - `@vercel/functions` was dropped because it failed the trust check.
  - `semver@6.3.1` is a reviewed exception (a legitimate backport).
- **TypeScript:** `typescript` points at the TS6 compatibility package so Next.js and typescript-eslint keep working. `@typescript/native` is TS 7 and runs `pnpm typecheck`.
- **Customer links are signed tokens:** each is an HMAC of `purpose:id:version` with a server-side pepper, and only its SHA-256 hash is stored. The server can regenerate a link for a reminder without ever storing the raw token.
- **Booking routes are grouped:** booking, manage and quote-link pages live in the `app/(flow)` route group (rendered per request, strict CSP, native scrolling). Marketing pages live in `app/(marketing)` (`ensureStatic = 'navigation'`).
- **Email:** react-email 6 (the old `@react-email/components` package is deprecated). One branded layout plus a data-driven message builder serves every email and SMS.
- **Seed catalog changes:**
  - Added an "Interior refresh" service so the Basic package makes sense.
  - Removed a "ceramic excludes wax" rule. It would have blocked the normal Premium + ceramic combination.

## Done (5 commits on `main`)

**Tooling and config**
- `package.json`, `pnpm-workspace.yaml` (the policy above), `tsconfig.json`, `next.config.ts` (Cache Components, security headers, images), PostCSS and Prettier.
- `config/business.ts` with a `ph()` placeholder registry in `config/placeholder.ts`.

**Domain logic (`lib/domain/`, pure and unit-testable)**
- `pricing.ts`: size overrides and multipliers, auto-added prerequisites, incompatible combinations, quote-only routing, too-long routing, surcharges, travel fee, promo codes, tax, deposit.
- `availability.ts` and `time.ts`: slot generation in the business's time zone using Temporal, safe across daylight-saving changes, with capacity, buffers, travel, lead time and blackout dates.
- `policy.ts`: cancellation fees and refunds, and reschedule rules.
- `booking-state.ts`: booking and quote state machines.
- `zones.ts`: service-area lookup by ZIP first, then by distance rings.
- `ics.ts`: calendar files and Google Calendar links.
- `csv.ts`: CSV export with formula-injection protection.
- `notifications.ts`: reminder timing with SMS quiet hours.
- `money.ts`, `ids.ts`, `settings.ts` (Zod schema for operational settings).

**Validation**
- `lib/validation/booking.ts` (each wizard step) and `lib/validation/actions.ts` (Server Action inputs). The browser and the server share the same Zod schemas.

**Database**
- `db/migrations/0001_init.sql`: the full schema.
  - The `no_double_booking` exclusion constraint covers holds, bookings and admin time blocks.
  - Partial unique indexes allow one active allocation per booking and one paid deposit per booking.
  - Includes the Better Auth tables.
- `db/schema.ts`: Drizzle mapping, including a custom `tstzrange` type.
- `db/client.ts`, `db/seed.ts`, `db/seed-data/catalog.ts` (14 services, 3 packages, rules, conditions) and `db/seed-data/content.ts` (clearly labelled samples).
- `scripts/db/`: `embedded.ts`, `dev.ts` (`pnpm dev:db`), `migrate.ts`, `ports.ts`.

**Server (`lib/server/`)**
- **Booking:**
  - `booking/holds.ts`: `createHold` (exclusion constraint plus a savepoint loop over crews/bays), sweeping expired holds, abandoned leads, extend and release.
  - `booking/checkout.ts`:
    - customer upsert with an SMS consent record
    - `startPayment` (re-prices on the server, applies promos, detects price changes, reuses Checkout Sessions)
    - `handlePaymentEvent`, which dedupes webhook events, checks the amount, refunds duplicate deposits and recovers or refunds late payments
  - `booking/manage.ts`: reschedule (atomic allocation swap), cancel with refund, admin status changes, recording the balance payment.
  - `booking/` also has context, location, pricing, quote lookup, the single status-transition writer, and the availability service.
- **Payments:** `payments/` has the Stripe driver (Checkout Sessions with `ui_mode: "elements"`, API version `2026-09-30.endive`) and a fake driver that sends signed webhooks to the real handler.
- **Outbox:** `outbox.ts` is a transactional outbox (`FOR UPDATE SKIP LOCKED`, exponential backoff). `jobs.ts` holds the cron tick and `flushOutbox`.
- **Notifications:** `notify/` covers enqueueing, message copy, Resend and Twilio channels, outbox handlers, and optional Google Calendar sync. The branded layout is `emails/branded-email.tsx`.
- **Quotes and leads:** `quotes.ts` (submit, send a priced quote, decline, signed photo uploads) and `leads.ts`.
- **Infrastructure:** `storage.ts` (R2 or local, with magic-byte checks), `places.ts`, `rate-limit.ts`, `captcha.ts`, `funnel.ts`, `clock.ts` (test-controllable), `tokens.ts`, `request.ts`, `test-mode.ts`.
- **Admin auth:** `auth.ts` (Better Auth, sign-up disabled, TOTP 2FA) and `admin-guard.ts`. `scripts/admin-create.ts` creates the first owner.
- **Config:** `lib/env.ts` parses the environment with Zod and refuses test drivers in production.

**Routes**
- `app/(flow)/book/actions.ts` holds every booking Server Action.
- API routes:
  - `availability`
  - `stripe/webhook`
  - `cron/tick`
  - `places/autocomplete`, `places/details`
  - `uploads/local`
  - `events`
  - `auth/[...all]`
  - `health`
  - `twilio/inbound`
  - `test/{clock,fake-pay,outbox}`
- `app/(flow)/booking/[token]/calendar.ics`

**Front-end foundation**
- `proxy.ts` and `lib/security/csp.ts`: strict nonce CSP on dynamic routes, a host allowlist on static pages, and a fast admin redirect.
- `app/globals.css`: design tokens (dark surfaces with a gold accent), view-transition CSS, reduced-motion rules.
- `app/layout.tsx` (Archivo variable font), `app/(marketing)/layout.tsx`, `app/(flow)/layout.tsx`.
- Site chrome in `components/site/`: header, mobile menu, footer, sticky mobile bar, logo.
- UI primitives in `components/ui/`: button, fields, radio cards, placeholder badge.
- Motion:
  - `lib/motion/engine.ts`: GSAP, ScrollTrigger, SplitText and Lenis, loaded only after hydration and idle.
  - `lib/motion/guard.ts`: allows only transform and opacity animations.
  - `components/motion/`: the motion root and the page-transition wrapper.
- `components/analytics/`: Plausible, field web vitals, and an ad-consent gate.
- `lib/analytics/track.ts`: funnel events and UTM/referrer capture.
- `components/marketing/exit-intent.tsx`.

## Still to do

1. **Move the project and get it building** (see "Blocker"). Also fill in the remaining `package.json` scripts: `dev:db`, `db:migrate`, `db:seed`, `admin:create`, `test`, `e2e`, `lhci`, `launch-check`.
2. **Marketing pages:**
   - home with all 12 sections: hero, trust bar, services, packages with the size toggle, before/after slider, how it works, why us, reviews, ZIP checker, memberships, FAQ, final call to action
   - `/services` and `/services/[slug]` (shared-element morph from the card)
   - `/pricing`, `/gallery` (filters and lightbox), `/about`, `/reviews`, `/faq`, `/contact`, `/quote`
   - `/areas/[city]`, `/gift-cards`, legal pages, `/accessibility`, 404 and error pages
   - SEO: metadata, JSON-LD, sitemap, robots, OG images
   - sample SVG images in `public/images/samples/`
3. **Booking front end:**
   - the 8-step wizard, with state kept in the URL and sessionStorage, a summary sidebar on desktop and a bottom sheet on mobile, and the hold countdown
   - the Stripe Checkout Elements step and the fake payment panel
   - `/book/return`, `/booking/[token]` (confirmation, reschedule, cancel), `/quote/[token]`
4. **3D hero:**
   - Model pipeline: gltf-transform with Meshopt and KTX2. The placeholder model is Khronos ToyCar (CC0), plus `LICENSE.txt`.
   - Poster rendering script.
   - Low-power and WebGL-failure fallbacks, an error boundary, a frame-rate guard, and cleanup on unmount.
5. **Admin dashboard:** login and 2FA; calendar (day/week with drag to reschedule); bookings; leads and quotes; catalog; schedule, area and settings; content; promo codes; customers; metrics; CSV export; health panel.
6. **Ops:**
   - `.env.example`
   - `README.md`: setup, environment variables, deploy steps, "Values to fill in" and an admin walkthrough
   - Dockerfile and docker-compose (app, Postgres, scheduler, migrate); `vercel.json` with a 5-minute cron
   - `scripts/launch-check.ts`, `scripts/check-bundle.ts`, `scripts/verification-report.ts`
   - a GitHub Actions CI workflow
7. **Phase 3:**
   - Vitest unit and integration tests (including the concurrent-hold test)
   - Playwright end-to-end tests for scenarios 1–17 on desktop Chrome, mobile Safari and mobile Chrome
   - site checks: crawl, accessibility (axe), reduced motion, WebGL off, SEO, headers, bundle size, INP
   - Lighthouse CI, then `docs/VERIFICATION.md`

## Known risks and follow-ups

- **Unverified code:** nothing has been compiled, so expect type errors on the first build.
- **Not yet checked against current docs:** Better Auth's `user.additionalFields` role mapping, Drizzle's `onConflictDoUpdate` with `targetWhere` on a partial index, and whether React 19.3 exports `ViewTransition` correctly in server components.
- **Ad tags on booking pages:** analytics and ad tags don't run on strict-CSP routes because of the nonce. A nonce-aware tag loader in the `(flow)` layout is needed if you want ad conversion tracking there.
- **Initial JS budget:** 170 KB gzip is tight. Measure it once the project builds.
- **Real Stripe tests:** end-to-end tests against real Stripe need your test-mode keys.
