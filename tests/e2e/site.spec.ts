/** Site-wide checks (docs/PLAN.md §12 "S-*"): crawl, axe, SEO, headers, motion, 3D fallbacks. */
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect, test } from "@playwright/test";

const PAGES = ["/", "/services", "/services/ceramic-coating", "/pricing", "/gallery", "/about", "/reviews", "/faq", "/contact", "/quote", "/book", "/privacy", "/terms", "/cancellation-policy", "/accessibility", "/areas/houston"];

test("S-CRAWL every internal link resolves (no 404s)", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const fromSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
  const queue = [...new Set([...PAGES, ...fromSitemap])];
  const seen = new Set<string>();
  const broken: string[] = [];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await request.get(path, { maxRedirects: 5 });
    if (res.status() >= 400) {
      broken.push(`${path} → ${res.status()}`);
      continue;
    }
    if (!(res.headers()["content-type"] ?? "").includes("text/html")) continue;
    await page.goto(path);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
    for (const h of hrefs) {
      if (!h.startsWith("/") || h.startsWith("//")) continue;
      const clean = h.split("#")[0]!;
      if (clean && !seen.has(clean) && !clean.startsWith("/booking/") && !clean.startsWith("/admin")) queue.push(clean);
    }
  }
  expect(broken, broken.join("\n")).toEqual([]);
});

test("S-AXE no serious/critical accessibility violations on any page", async ({ page }) => {
  const problems: string[] = [];
  // Audit the settled page: reveals and the route fade animate opacity only, and axe would
  // otherwise measure contrast mid-fade. Reduced motion renders the final state immediately.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of [...PAGES, "/does-not-exist"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    for (const v of results.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) problems.push(`${path}: ${v.id} (${v.nodes.length})`);
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("S-SEO unique titles/descriptions, one H1, canonical, JSON-LD", async ({ page }) => {
  const titles = new Map<string, string>();
  for (const path of PAGES.filter((p) => p !== "/book")) {
    await page.goto(path);
    const title = await page.title();
    expect(titles.has(title), `duplicate title "${title}" on ${path} and ${titles.get(title)}`).toBe(false);
    titles.set(title, path);
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
    expect(await page.locator("h1").count(), `${path} h1 count`).toBe(1);
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBeTruthy();
    expect(await page.locator('meta[property="og:title"]').count()).toBeGreaterThan(0);
  }
  await page.goto("/");
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((x) => JSON.parse(x)["@type"] === "AutoWash")).toBe(true);
  await page.goto("/faq");
  expect((await page.locator('script[type="application/ld+json"]').allTextContents()).some((x) => JSON.parse(x)["@type"] === "FAQPage")).toBe(true);
  await page.goto("/services/ceramic-coating");
  const svc = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((x) => JSON.parse(x)["@type"]);
  expect(svc).toEqual(expect.arrayContaining(["Service", "BreadcrumbList"]));
});

test("S-SEO robots and sitemap", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/admin/);
  expect(robots).toMatch(/Sitemap:/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/services/ceramic-coating");
  expect(sitemap).toContain("/areas/houston");
});

test("S-HEADERS security headers; nonce CSP on booking routes", async ({ request }) => {
  const home = await request.get("/");
  const h = home.headers();
  expect(h["strict-transport-security"]).toContain("max-age");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).not.toContain("unsafe-eval");
  const book = await request.get("/book");
  expect(book.headers()["content-security-policy"]).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
  expect(book.headers()["x-robots-tag"]).toContain("noindex");
});

test("S-REDUCED reduced motion: no Lenis, no 3D, content visible", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => document.documentElement.classList.contains("lenis"))).toBe(false);
  expect(await page.getByTestId("hero-canvas").count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.dataset.hero3d)).toMatch(/^off:reduced-motion/);
  await expect(page.getByRole("heading", { name: /packages|simple packages/i })).toBeVisible();
  // Nothing animated may be left faded out: the engine skips those effects under reduced motion,
  // so a CSS pre-state that hides them would leave whole sections blank.
  for (const path of ["/", "/pricing", "/about"]) {
    await page.goto(path);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(1500);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-reveal],[data-depth],[data-fan-item],[data-stack-card],[data-recede]")]
        .filter((el) => Number(getComputedStyle(el).opacity) < 1)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 40)}`),
    );
    expect(hidden, `${path}: ${hidden.join(", ")}`).toEqual([]);
  }
  await ctx.close();
});

test("S-WEBGL-OFF 3D disabled → poster stays, no errors", async () => {
  const browser = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] });
  const page = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  // The WebGL probe runs on first interaction (or idle), so interact only once the hero has
  // hydrated and its listeners are attached; a move before that is never seen.
  const hero3d = () => page.evaluate(() => document.documentElement.dataset.hero3d ?? "");
  await expect.poll(hero3d).not.toBe("");
  await page.mouse.move(10, 10);
  await page.mouse.move(60, 60);
  await expect.poll(hero3d, { timeout: 10_000 }).toMatch(/^off:/);
  await expect(page.locator('img[fetchpriority="high"]').first()).toBeVisible();
  expect(errors).toEqual([]);
  await browser.close();
});

test("S-LOWPOWER low-power/save-data devices get the poster", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 2 });
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => document.documentElement.dataset.hero3d)).toBe("off:low-power");
  await ctx.close();
});

test("S-IMAGES hero is eager/high priority; below-the-fold images lazy", async ({ page }) => {
  // Below-the-fold images (the gallery has none until real photos are added) must all be lazy.
  await page.goto("/gallery");
  const images = await page.locator("main img").count();
  const lazy = await page.locator('main img[loading="lazy"]').count();
  expect(lazy).toBe(images);
  await page.goto("/");
  const hero = page.locator('img[fetchpriority="high"]').first();
  expect(await hero.getAttribute("loading")).not.toBe("lazy");
});

test("S-FONTS at most two font families are downloaded", async ({ page }) => {
  const fonts = new Set<string>();
  page.on("response", (r) => {
    if (r.request().resourceType() === "font") fonts.add(new URL(r.url()).pathname.split("/").pop()!.split("-")[0]!);
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(fonts.size).toBeLessThanOrEqual(2);
});

test("S-TAP interactive targets are at least 44px on mobile", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const small: string[] = [];
  for (const path of ["/", "/book", "/contact"]) {
    await page.goto(path);
    const found = await page.$$eval("main a, main button, main [role=radio], nav a, nav button", (els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null && !(el as HTMLElement).closest("p, li p, blockquote"))
        .map((el) => ({ r: el.getBoundingClientRect(), t: (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30) }))
        .filter(({ r }) => r.width > 0 && (r.height < 44 || r.width < 24))
        .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    small.push(...found.map((f) => `${path}: ${f}`));
  }
  expect(small, small.join("\n")).toEqual([]);
  await ctx.close();
});

test("S-ERRORS styled 404", async ({ page }) => {
  const res = await page.goto("/definitely-not-here");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /wrong turn/i })).toBeVisible();
});

test("S-VT view transition fallback when the API is missing", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    // @ts-expect-error simulate an older browser
    delete Document.prototype.startViewTransition;
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("link", { name: /^services$/i }).first().click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await ctx.close();
});
