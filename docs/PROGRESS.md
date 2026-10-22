# Build Progress — Premium Car Detailing Website

_Last updated: 2026-10-22_

| Phase | Status |
|---|---|
| Phase 1 — Plan | ✅ Done (`docs/PLAN.md`) |
| Phase 2 — Build | 🟡 **All planned code is written. None of it has been compiled or run yet** (see "Blocker") |
| Phase 3 — Verify | 🟡 Test suites are written (unit, integration, end-to-end, site checks, Lighthouse, bundle budget). **None have been run.** |

## Blocker: move the project to a short folder path

The project still lives in a temporary folder 187 characters deep. Windows caps paths at 260 characters, so esbuild, Postgres and Next's compiler can't start from here. Nothing has been typechecked, built or tested.

**Next steps, once it's in a short path such as `C:\dev\detailing-site`:**

```
pnpm install
pnpm typecheck        # fix compile errors (expect some: first build of never-run code)
pnpm lint
pnpm test             # unit + integration (starts its own Postgres)
pnpm exec playwright install chromium webkit firefox
pnpm e2e              # builds, seeds an isolated DB, runs scenarios 1–17 + admin + smoke
pnpm site-checks
pnpm check:bundle && pnpm lhci
pnpm verify:report    # writes docs/VERIFICATION.md
```

## What exists (commits on `main`)

| Area | Files |
|---|---|
| Plan & docs | `docs/PLAN.md`, `README.md` (setup, deploy, Values to fill in, admin walkthrough), this file |
| Config | `config/business.ts`, `config/placeholder.ts`, `.env.example`, `pnpm-workspace.yaml` (supply-chain policy) |
| Database | `db/migrations/0001_init.sql` (exclusion constraint), `db/schema.ts`, `db/seed.ts` + `db/seed-data/*`, `scripts/db/*` |
| Domain engines | `lib/domain/*`: pricing/rules, availability (DST-safe), policy, state machines, zones, ICS, CSV, reminders |
| Booking backend | `lib/server/booking/*`: holds, checkout/webhooks/late payment, manage (reschedule/cancel), availability service; plus payments (Stripe + fake), outbox, notifications + email layout, quotes, leads, storage, places, rate limiting, captcha, auth, jobs |
| Routes | `app/api/*`: availability, Stripe webhook, cron, Places, uploads, events, auth, health, Twilio, admin export, test-only endpoints; `app/(flow)/book/actions.ts`, `app/(flow)/booking/[token]/actions.ts` |
| Marketing site | `app/(marketing)/*`: home (12 sections), services + service pages, pricing, gallery, about, reviews, FAQ, contact, quote, city pages, gift cards, legal pages, accessibility; sitemap, robots, OG image, 404/error |
| Motion & 3D | `lib/motion/engine.ts` (GSAP + ScrollTrigger + SplitText + Lenis, deferred), `components/motion/*`, `components/three/hero-canvas.tsx`, `components/marketing/home/hero*.tsx` |
| Booking UI | `components/booking/*`: wizard, 8 steps, summary/bottom sheet, hold countdown, photo uploader, payment panel, manage/confirmation; `app/(flow)/*` pages |
| Admin | `app/admin/*`: login + 2FA, overview metrics + health, calendar (drag + keyboard move), bookings, leads, quotes, customers, catalog, schedule, service area, settings, promo codes, content, export |
| Security | `proxy.ts` + `lib/security/csp.ts` (nonce CSP on dynamic routes), headers in `next.config.ts`, server-side admin guard, signed tokens, Turnstile, rate limits |
| Ops | `scripts/launch-check.ts`, `scripts/check-bundle.ts`, `scripts/optimize-model.ts`, `scripts/verification-report.ts`, `scripts/e2e-server.ts`, `Dockerfile`, `docker-compose.yml`, `vercel.json`, `.github/workflows/ci.yml`, `lighthouserc.cjs` |
| Tests | `tests/unit/*`, `tests/integration/*` (real Postgres, concurrency), `tests/e2e/booking.spec.ts` (E2E-01…17), `admin.spec.ts`, `site.spec.ts` |

## Known gaps and risks

- **Never compiled.** Expect type errors and some selector mismatches in the end-to-end tests on the first run. That's the first job after the move.
- **3D model:** no model is checked in. The hero shows the static poster until a licensed `public/models/car.glb` is added; the HEAD check skips Three.js entirely when it's missing. The poster is a placeholder illustration.
- **Not yet verified against current docs:** Better Auth (role additional field, two-factor client API), Drizzle (`onConflictDoUpdate` with `targetWhere`, `.for("update")`), React `ViewTransition` in server components, react-day-picker v10 `timeZone`, Stripe `CheckoutElementsProvider` options.
- **Ad conversion tags** (GA4/Meta) don't run on the nonce-CSP booking routes yet. Plausible works.
- **Real Stripe test-mode end-to-end runs** need your Stripe test keys.
- **Real-device / BrowserStack testing** isn't possible here; only emulation.
- **Budgets:** the 170 KB initial-JS and Lighthouse targets can only be checked once the project builds.
