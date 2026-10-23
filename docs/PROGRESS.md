# Build Progress — Premium Car Detailing Website

_Last updated: 2026-10-23_

| Phase | Status |
|---|---|
| Phase 1 — Plan | ✅ Done (`docs/PLAN.md`) |
| Phase 2 — Build | ✅ Done. Production build passes; lint and typecheck clean |
| Phase 3 — Verify | ✅ Done. Every suite green: see [`VERIFICATION.md`](VERIFICATION.md) |

Project location: `C:\dev\detailing-site` (moved out of the temp folder and Downloads; the old copies are deleted).

## Final results (same production build)

| Check | Result |
|---|---|
| Lint + typecheck | Clean |
| Unit + integration (Vitest, real Postgres) | 84 / 84 |
| End-to-end + site checks (Playwright) | 73 / 73 across desktop Chrome, mobile Safari (WebKit), mobile Chrome, site checks, Firefox and desktop WebKit smoke. No retries needed |
| Requirements mapped in VERIFICATION.md | 52 / 52 pass, plus the bundle budget |
| Home page initial JS (mobile) | 167.4 KB (budget 170 KB); no 3D/GSAP/Lenis before `load` |
| Lighthouse mobile (real throttling) | Perf 96–98, a11y 100, best practices 100, LCP 1.7–2.1 s, CLS 0 |
| Lighthouse desktop | Perf 100, a11y 100, best practices 100, CLS 0 |

## Bugs the verification run caught and fixed

- **Double-booking race:** concurrent holds on one crew could deadlock (40P01) instead of returning "slot taken". Fixed with ordered per-resource advisory locks plus a retry backstop; the exclusion constraint is still the guarantee.
- **Booking and admin pages didn't work in production:** a prerendered shell shipped scripts without the CSP nonce, so nothing ran. Those routes now render per request.
- **Safari loaded nothing over plain HTTP:** `upgrade-insecure-requests` is now only sent when the site is HTTPS.
- **Holds expired instantly** when a device clock disagreed with the server: expiry is now measured on the browser's own clock.
- **Browser back button** in the booking wizard could jump to the wrong step.
- **Mobile "Continue" tap did nothing** on the contact step: blur-time validation moved the button mid-tap. Validation now runs on submit.
- **Layout shift (CLS 0.115)** on service pages when the web font loaded; fixed.
- Home page JavaScript cut from 198 KB to 167 KB; Stripe.js now loads only at the payment step.
- Smaller fixes: OG image, favicon, star-rating accessibility, Zod eval probe under the strict CSP, places API caching, launch-check wording.

## What's left (needs you, not code)

`pnpm launch-check` lists everything still to do before going live: 51 items right now, all business details, content and accounts:

- **Business details** in `config/business.ts` (name, phone, address, hours, zones, prices, proof points). See README → *Values to fill in*.
- **Real content in Admin:** reviews, gallery photos, city pages, and ticking "prices reviewed".
- **Accounts and keys:** Stripe, Resend (+ email DNS), Turnstile, cron secret, optional Twilio (start toll-free verification early) and R2 for photo uploads.
- **3D model:** a licensed, debadged `public/models/car.glb` + licence. Until then the hero shows the poster image.
- **Legal:** have the privacy, terms, cancellation and SMS-consent wording reviewed.
- **Not testable here:** real phones/BrowserStack, real Stripe test-mode runs (needs your test keys), email/SMS deliverability.
