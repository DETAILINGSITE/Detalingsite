import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

const extraContexts: BrowserContext[] = [];

/**
 * A second, independent visitor (own cookies and storage) with the current project's device
 * emulation; browser.newPage() would give a desktop page even in the mobile projects.
 * Carries the configured time zone and locale too (see playwright.config.ts).
 */
export async function newTab(browser: Browser): Promise<Page> {
  const u = test.info().project.use;
  const ctx = await browser.newContext({
    baseURL: process.env.BASE_URL ?? u.baseURL,
    timezoneId: u.timezoneId,
    locale: u.locale,
    viewport: u.viewport,
    userAgent: u.userAgent,
    deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile,
    hasTouch: u.hasTouch,
  });
  extraContexts.push(ctx);
  return ctx.newPage();
}

/** Close every tab opened with newTab (call from afterEach). */
export async function closeTabs() {
  await Promise.all(extraContexts.splice(0).map((c) => c.close()));
}

/** Freeze server time (TEST_CLOCK=1) and reset rate limits. Default: Thu 2026-10-22 10:00 CDT. */
export async function setClock(request: APIRequestContext, iso = "2026-10-22T15:00:00Z") {
  const r = await request.post("/api/test/clock", { data: { to: iso } });
  expect(r.ok()).toBeTruthy();
  // Every test starts with fresh rate-limit counters (same IP, same pinned instant).
  expect((await request.delete("/api/test/rate-limits")).ok()).toBeTruthy();
}

export async function advanceClock(request: APIRequestContext, ms: number) {
  await request.post("/api/test/clock", { data: { advanceMs: ms } });
}

export async function outbox(request: APIRequestContext, booking: string) {
  await request.post("/api/test/outbox", { data: { action: "flush" } });
  const r = await request.get(`/api/test/outbox?booking=${encodeURIComponent(booking)}`);
  return (await r.json()).items as { type: string; status: string; template: string; audience: string; rendered: { to: string; subject?: string; body?: string } | null }[];
}

export async function next(page: Page, label = /continue/i) {
  await page.getByRole("button", { name: label }).click();
}

export async function startService(page: Page, opts: { size?: string; pkg?: string; addons?: string[] } = {}) {
  await page.goto("/book");
  await page.getByRole("radio", { name: /choose a service or package/i }).click();
  await next(page);
  await page.getByRole("radio", { name: new RegExp(opts.size ?? "Sedan", "i") }).click();
  await next(page);
  await page.getByRole("radio", { name: new RegExp(`^${opts.pkg ?? "Gold"}`, "i") }).click();
  for (const a of opts.addons ?? []) await page.getByRole("checkbox", { name: new RegExp(a, "i") }).click();
  await next(page);
}

export async function mobileAddress(page: Page, zip = "77002") {
  await page.getByRole("radio", { name: /come to me/i }).click();
  await page.getByLabel(/street address/i).fill("1 Test Street");
  await page.getByLabel(/^city/i).fill("Houston");
  await page.getByLabel(/^state/i).fill("TX");
  await page.getByLabel(/^zip/i).fill(zip);
}

export async function pickFirstSlot(page: Page) {
  const slot = page.getByRole("radiogroup", { name: /available times/i }).getByRole("radio").first();
  await expect(slot).toBeVisible();
  await slot.click();
  await expect(page.getByText(/held for you/i)).toBeVisible();
}

export async function fillContact(page: Page, p: { name?: string; phone?: string; email?: string } = {}) {
  await page.getByLabel(/full name/i).fill(p.name ?? "Alex Driver");
  await page.getByLabel(/mobile phone/i).fill(p.phone ?? "(201) 555-0131");
  await page.getByLabel(/^email/i).fill(p.email ?? "alex@example.com");
}

export async function agreeAndPay(page: Page) {
  await page.getByRole("checkbox", { name: /cancellation policy/i }).click();
  await page.getByRole("button", { name: /continue to payment|confirm booking/i }).click();
}

export async function fakePaySuccess(page: Page) {
  await page.getByTestId("fake-payment").getByRole("button", { name: /succeeds/i }).click();
  await expect(page).toHaveURL(/\/booking\/[A-Za-z0-9_-]{43}/);
  await expect(page.getByRole("heading", { name: /you're booked/i })).toBeVisible({ timeout: 30_000 });
}

export async function bookingNumber(page: Page) {
  const text = await page.getByText(/^Booking MJ-/).first().textContent();
  return /MJ-[0-9A-Z]{6}/.exec(text ?? "")?.[0] ?? "";
}
