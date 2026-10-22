/**
 * `pnpm verify:report` → docs/VERIFICATION.md
 * Maps every requirement ID (docs/PLAN.md §12) to the tests that carry that ID in their
 * title, with pass/fail from the Vitest and Playwright JSON reports, plus Lighthouse
 * medians if .lighthouseci exists. Requirements with no executed test are listed as NOT RUN.
 */
import fs from "node:fs";
import path from "node:path";

interface Result {
  title: string;
  status: "passed" | "failed" | "skipped";
  project?: string;
}

const REQUIREMENTS: [string, string][] = [
  ["E2E-01", "Package → sedan → 2 add-ons → mobile → slot → deposit → confirmation → notifications"],
  ["E2E-02", "SUV/truck multiplier applied everywhere"],
  ["E2E-03", "In-shop path"],
  ["E2E-04", "Out-of-area address → friendly block + quote option"],
  ["E2E-05", "Custom job → photos → quote request saved"],
  ["E2E-06", "Two users race for one slot → one succeeds, other sees alternatives"],
  ["E2E-07", "Slot hold expires → slot available again"],
  ["E2E-08", "Declined / 3-D Secure / closed payment → retry possible, no confirmed booking"],
  ["E2E-09", "Webhook delivered twice → one booking"],
  ["E2E-10", "Refresh and browser back preserve state"],
  ["E2E-11", "Reschedule via manage link"],
  ["E2E-12", "Cancel outside window (E2E) — inside window covered by I-CANCEL"],
  ["E2E-13", "Closed days disabled (DST/blackout covered by U-AVAIL-09/10, I-AVAIL)"],
  ["E2E-14", "Job longer than a day → quote"],
  ["E2E-15", "Invalid inputs → clear errors, can't advance"],
  ["E2E-16", "Deposit disabled → confirmed without payment"],
  ["E2E-17", "Keyboard-only completion"],
  ["E2E-ADMIN", "Booking visible in admin; admin auth; CSV export"],
  ["U-PRICE", "Pricing engine (all combinations, multipliers, overrides, surcharges, promo, tax, deposit)"],
  ["U-RULES", "Service rules: prerequisites, exclusions, quote routing"],
  ["U-AVAIL", "Availability engine: capacity, buffers, travel, time zones, DST"],
  ["U-POLICY", "Cancellation fee & reschedule logic"],
  ["U-STATE", "Booking/quote state machines"],
  ["U-ZONE", "Service area"],
  ["U-VALID", "Validation schemas"],
  ["U-TOKEN", "Signed customer links"],
  ["U-ICS", "Calendar files"],
  ["U-CSV", "CSV export / formula injection"],
  ["U-NOTIFY", "Reminder timing & quiet hours"],
  ["U-CSP", "Content-Security-Policy"],
  ["U-ENV", ".env.example completeness"],
  ["I-DB-EXCL", "Double-booking prevented in the database under concurrency"],
  ["I-HOLD", "Holds, idempotency, expiry, abandoned leads"],
  ["I-WEBHOOK", "Webhook dedupe & amount verification"],
  ["I-LATE-PAY", "Late payment re-acquire / refund"],
  ["I-NO-DEPOSIT", "No-deposit confirmation"],
  ["I-PRICE-TAMPER", "Server-side price recomputation"],
  ["I-RESCHEDULE", "Reschedule frees old slot, re-keys reminders"],
  ["I-CANCEL", "Cancel inside/outside window"],
  ["I-QUOTE", "Quote lifecycle & link rotation"],
  ["I-LEAD", "Leads & owner notification"],
  ["S-CRAWL", "Every link works"],
  ["S-AXE", "No serious/critical axe violations"],
  ["S-SEO", "Titles, H1, canonical, JSON-LD, sitemap, robots"],
  ["S-HEADERS", "Security headers & nonce CSP"],
  ["S-REDUCED", "Reduced motion"],
  ["S-WEBGL-OFF", "3D fallback with WebGL disabled"],
  ["S-LOWPOWER", "Low-power fallback"],
  ["S-TAP", "Tap targets ≥ 44px"],
  ["S-FONTS", "≤ 2 font families"],
  ["S-IMAGES", "Hero eager, below-fold lazy"],
  ["S-VT", "View-transition fallback"],
];

function collect(): Result[] {
  const out: Result[] = [];
  const vitest = "test-results/vitest.json";
  if (fs.existsSync(vitest)) {
    const j = JSON.parse(fs.readFileSync(vitest, "utf8")) as { testResults: { assertionResults: { fullName: string; status: string }[] }[] };
    for (const f of j.testResults) for (const a of f.assertionResults) out.push({ title: a.fullName, status: a.status === "passed" ? "passed" : a.status === "failed" ? "failed" : "skipped" });
  }
  const pw = "test-results/playwright.json";
  if (fs.existsSync(pw)) {
    type Suite = { specs?: { title: string; tests: { projectName: string; results: { status: string }[] }[] }[]; suites?: Suite[] };
    const walk = (s: Suite) => {
      for (const spec of s.specs ?? [])
        for (const t of spec.tests) {
          const last = t.results.at(-1)?.status ?? "skipped";
          out.push({ title: spec.title, project: t.projectName, status: last === "passed" ? "passed" : last === "skipped" ? "skipped" : "failed" });
        }
      for (const c of s.suites ?? []) walk(c);
    };
    walk(JSON.parse(fs.readFileSync(pw, "utf8")) as Suite);
  }
  return out;
}

function lighthouse(): string {
  const dir = ".lighthouseci";
  if (!fs.existsSync(dir)) return "_Not run._";
  const rows: string[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("lhr-") && x.endsWith(".json"))) {
    const lhr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { finalUrl: string; configSettings: { formFactor: string }; categories: Record<string, { score: number }>; audits: Record<string, { numericValue?: number }> };
    rows.push(`| ${new URL(lhr.finalUrl).pathname} | ${lhr.configSettings.formFactor} | ${Math.round(lhr.categories.performance!.score * 100)} | ${Math.round((lhr.audits["largest-contentful-paint"]?.numericValue ?? 0))} ms | ${(lhr.audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)} | ${Math.round(lhr.audits["total-blocking-time"]?.numericValue ?? 0)} ms |`);
  }
  return rows.length ? `| Page | Form factor | Perf | LCP | CLS | TBT |\n|---|---|---|---|---|---|\n${rows.join("\n")}` : "_Not run._";
}

const results = collect();
const lines = REQUIREMENTS.map(([id, label]) => {
  const matched = results.filter((r) => r.title.includes(id));
  const status = matched.length === 0 ? "NOT RUN" : matched.some((m) => m.status === "failed") ? "FAIL" : matched.every((m) => m.status === "skipped") ? "SKIPPED" : "PASS";
  const projects = [...new Set(matched.map((m) => m.project).filter(Boolean))].join(", ");
  return `| ${id} | ${label} | ${matched.length}${projects ? ` (${projects})` : ""} | **${status}** |`;
});

const md = `# Verification report

_Generated ${new Date().toISOString()} by \`pnpm verify:report\` from the latest test runs._

Totals: ${results.filter((r) => r.status === "passed").length} passed · ${results.filter((r) => r.status === "failed").length} failed · ${results.filter((r) => r.status === "skipped").length} skipped.

## Requirements → tests

| ID | Requirement | Tests (projects) | Result |
|---|---|---|---|
${lines.join("\n")}

## Lighthouse

${lighthouse()}

## Known limitations

- Real devices / BrowserStack were not available; mobile coverage is Playwright WebKit (iPhone 15) and Chromium (Pixel 7) emulation.
- Payments are exercised through the fake driver and the real webhook handler. Real Stripe test-mode E2E (\`pnpm e2e:stripe\`) needs Stripe test keys.
- Email/SMS deliverability isn't tested (captured driver); it depends on Resend DNS and Twilio registration.
- INP is a field metric; lab runs use Total Blocking Time as the proxy, and production RUM reports INP to Plausible.
`;
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/VERIFICATION.md", md);
console.log(`Wrote docs/VERIFICATION.md (${results.length} test results).`);
