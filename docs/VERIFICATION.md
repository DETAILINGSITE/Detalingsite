# Verification report

_Generated 2026-10-23T05:40:32.134Z by `pnpm verify:report` from the latest test runs._

Totals: 157 passed · 0 failed · 0 skipped.

## Requirements → tests

| ID | Requirement | Tests (projects) | Result |
|---|---|---|---|
| E2E-01 | Package → sedan → 2 add-ons → mobile → slot → deposit → confirmation → notifications | 5 (desktop-chrome, mobile-safari, mobile-chrome, desktop-firefox, desktop-webkit) | **PASS** |
| E2E-02 | SUV/truck multiplier applied everywhere | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-03 | In-shop path | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-04 | Out-of-area address → friendly block + quote option | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-05 | Custom job → photos → quote request saved | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-06 | Two users race for one slot → one succeeds, other sees alternatives | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-07 | Slot hold expires → slot available again | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-08 | Declined / 3-D Secure / closed payment → retry possible, no confirmed booking | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-09 | Webhook delivered twice → one booking | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-10 | Refresh and browser back preserve state | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-11 | Reschedule via manage link | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-12 | Cancel outside window (E2E) — inside window covered by I-CANCEL | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-13 | Closed days disabled (DST/blackout covered by U-AVAIL-09/10, I-AVAIL) | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-14 | Job longer than a day → quote | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-15 | Invalid inputs → clear errors, can't advance | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-16 | Deposit disabled → confirmed without payment | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-17 | Keyboard-only completion | 3 (desktop-chrome, mobile-safari, mobile-chrome) | **PASS** |
| E2E-ADMIN | Booking visible in admin; admin auth; CSV export | 4 (desktop-chrome, desktop-firefox, desktop-webkit) | **PASS** |
| U-PRICE | Pricing engine (all combinations, multipliers, overrides, surcharges, promo, tax, deposit) | 21 | **PASS** |
| U-RULES | Service rules: prerequisites, exclusions, quote routing | 8 | **PASS** |
| U-AVAIL | Availability engine: capacity, buffers, travel, time zones, DST | 14 | **PASS** |
| U-POLICY | Cancellation fee & reschedule logic | 6 | **PASS** |
| U-STATE | Booking/quote state machines | 4 | **PASS** |
| U-ZONE | Service area | 3 | **PASS** |
| U-VALID | Validation schemas | 5 | **PASS** |
| U-TOKEN | Signed customer links | 1 | **PASS** |
| U-ICS | Calendar files | 1 | **PASS** |
| U-CSV | CSV export / formula injection | 1 | **PASS** |
| U-NOTIFY | Reminder timing & quiet hours | 2 | **PASS** |
| U-CSP | Content-Security-Policy | 2 | **PASS** |
| U-ENV | .env.example completeness | 2 | **PASS** |
| I-DB-EXCL | Double-booking prevented in the database under concurrency | 3 | **PASS** |
| I-HOLD | Holds, idempotency, expiry, abandoned leads | 3 | **PASS** |
| I-WEBHOOK | Webhook dedupe & amount verification | 2 | **PASS** |
| I-LATE-PAY | Late payment re-acquire / refund | 2 | **PASS** |
| I-NO-DEPOSIT | No-deposit confirmation | 1 | **PASS** |
| I-PRICE-TAMPER | Server-side price recomputation | 1 | **PASS** |
| I-RESCHEDULE | Reschedule frees old slot, re-keys reminders | 1 | **PASS** |
| I-CANCEL | Cancel inside/outside window | 1 | **PASS** |
| I-QUOTE | Quote lifecycle & link rotation | 2 | **PASS** |
| I-LEAD | Leads & owner notification | 1 | **PASS** |
| S-CRAWL | Every link works | 1 (site-checks) | **PASS** |
| S-AXE | No serious/critical axe violations | 1 (site-checks) | **PASS** |
| S-SEO | Titles, H1, canonical, JSON-LD, sitemap, robots | 2 (site-checks) | **PASS** |
| S-HEADERS | Security headers & nonce CSP | 1 (site-checks) | **PASS** |
| S-REDUCED | Reduced motion | 1 (site-checks) | **PASS** |
| S-WEBGL-OFF | 3D fallback with WebGL disabled | 1 (site-checks) | **PASS** |
| S-LOWPOWER | Low-power fallback | 1 (site-checks) | **PASS** |
| S-TAP | Tap targets ≥ 44px | 1 (site-checks) | **PASS** |
| S-FONTS | ≤ 2 font families | 1 (site-checks) | **PASS** |
| S-IMAGES | Hero eager, below-fold lazy | 1 (site-checks) | **PASS** |
| S-VT | View-transition fallback | 1 (site-checks) | **PASS** |

## Lighthouse

Medians. Budgets: performance ≥ 90 mobile / ≥ 95 desktop, LCP ≤ 2500 ms, CLS ≤ 0.1, TBT ≤ 200 ms, accessibility and SEO ≥ 95. `/book` is deliberately `noindex` (a checkout step), so its crawlability audit, and only that, is excused.

| Page | Profile | Runs | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|---|
| / | desktop (simulate) | 3 | 100 | 100 | 100 | 100 | 644 ms | 0.000 | 0 ms |
| / | mobile (devtools) | 3 | 96 | 100 | 100 | 100 | 2065 ms | 0.000 | 117 ms |
| /book | desktop (simulate) | 3 | 100 | 100 | 100 | 66 | 771 ms | 0.000 | 0 ms |
| /book | mobile (devtools) | 3 | 98 | 100 | 100 | 66 | 1676 ms | 0.000 | 99 ms |
| /services/ceramic-coating | desktop (simulate) | 3 | 100 | 100 | 100 | 100 | 617 ms | 0.000 | 0 ms |
| /services/ceramic-coating | mobile (devtools) | 3 | 98 | 100 | 100 | 100 | 1851 ms | 0.000 | 69 ms |

## Bundle budget

Home page, mobile profile, compressed JavaScript transferred before `load`: **167.4 KB** across 13 scripts (budget 170 KB). Three.js / GSAP / Lenis loaded before `load`: none. **PASS**

## Known limitations

- Real devices / BrowserStack were not available; mobile coverage is Playwright WebKit (iPhone 15) and Chromium (Pixel 7) emulation.
- Microsoft Edge wasn't installed on the machine that produced this report, so the Edge smoke project was skipped. It runs wherever Edge is installed (for example Windows CI runners). Firefox and desktop WebKit smoke runs are included.
- Mobile Lighthouse uses real (devtools) throttling. Lighthouse's default *simulated* mode estimates mobile LCP at about 3.0 s for the marketing pages, because it charges all early JavaScript to LCP. Measured LCP under the same throttling is 1.7–2.1 s, and unthrottled it's 0.2–0.4 s.
- `pnpm launch-check` is expected to fail until the business details, real content, production keys and a licensed 3D model are added (README → Values to fill in).
- Payments are exercised through the fake driver and the real webhook handler. Real Stripe test-mode E2E (`pnpm e2e:stripe`) needs Stripe test keys.
- Email/SMS deliverability isn't tested (captured driver); it depends on Resend DNS and Twilio registration.
- INP is a field metric; lab runs use Total Blocking Time as the proxy, and production RUM reports INP to Plausible.
