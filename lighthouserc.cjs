/**
 * Lighthouse CI budgets (docs/PLAN.md §7). Run against a production server:
 *   SKIP_BUILD=1 pnpm exec tsx scripts/e2e-server.ts &   (or any `next start`)
 *   pnpm lhci
 * Mobile: perf ≥ 0.90; desktop (LHCI_PRESET=desktop): perf ≥ 0.95.
 */
const base = process.env.BASE_URL ?? "http://localhost:3100";
const desktop = process.env.LHCI_PRESET === "desktop";

module.exports = {
  ci: {
    collect: {
      url: [`${base}/`, `${base}/services/ceramic-coating`, `${base}/book`],
      numberOfRuns: 3,
      settings: desktop ? { preset: "desktop" } : { formFactor: "mobile", throttlingMethod: "simulate" },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: desktop ? 0.95 : 0.9, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["warn", { minScore: 0.95 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500, aggregationMethod: "median-run" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, aggregationMethod: "median-run" }],
        "total-blocking-time": ["error", { maxNumericValue: 200, aggregationMethod: "median-run" }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
