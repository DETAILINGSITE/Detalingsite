/**
 * `pnpm check:bundle` — initial JS budget for the mobile home page (docs/PLAN.md §7).
 * Starts nothing itself: run against `pnpm start` (BASE_URL, default http://localhost:3000).
 * Measures gzip-encoded JS transferred before the `load` event on a mobile profile,
 * and asserts that no Three.js / GSAP chunk is part of it.
 */
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const BUDGET_KB = Number(process.env.JS_BUDGET_KB ?? 170);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
const scripts: { url: string; bytes: number }[] = [];
let loaded = false;
page.on("response", async (res) => {
  if (loaded) return;
  const type = res.request().resourceType();
  if (type !== "script") return;
  const len = Number(res.headers()["content-length"] ?? 0) || (await res.body().catch(() => Buffer.alloc(0))).length;
  scripts.push({ url: res.url(), bytes: len });
});
await page.goto(BASE, { waitUntil: "load" });
loaded = true;
const total = scripts.reduce((a, s) => a + s.bytes, 0) / 1024;
const heavy = scripts.filter((s) => /three|gsap|lenis|react-three|drei/i.test(s.url));
console.log(`Initial JS: ${total.toFixed(1)} KB across ${scripts.length} scripts (budget ${BUDGET_KB} KB)`);
for (const s of scripts.sort((a, b) => b.bytes - a.bytes).slice(0, 8)) console.log(`  ${(s.bytes / 1024).toFixed(1).padStart(7)} KB  ${s.url.replace(BASE, "")}`);
await browser.close();
let fail = false;
if (total > BUDGET_KB) {
  console.error(`✖ Over budget by ${(total - BUDGET_KB).toFixed(1)} KB`);
  fail = true;
}
if (heavy.length) {
  console.error(`✖ Heavy chunks loaded before 'load': ${heavy.map((h) => h.url).join(", ")}`);
  fail = true;
}
process.exit(fail ? 1 : 0);
