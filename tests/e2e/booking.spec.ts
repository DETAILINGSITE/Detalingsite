/**
 * Booking E2E — brief §9 scenarios 1–17. Runs on desktop-chrome, mobile-safari and
 * mobile-chrome (fake payment driver, captured notifications, test clock).
 */
import { expect, test } from "@playwright/test";
import { advanceClock, agreeAndPay, bookingNumber, closeTabs, fakePaySuccess, fillContact, mobileAddress, newTab, next, outbox, pickFirstSlot, setClock, startService } from "./helpers";

test.beforeEach(async ({ request }) => {
  await setClock(request);
});
test.afterEach(closeTabs);

test("E2E-01 package → sedan → 2 add-ons → mobile → slot → contact → deposit → confirmed, notified @smoke", async ({ page, request }) => {
  await startService(page, { size: "Sedan", pkg: "Premium", addons: ["Headlight restoration", "Engine bay"] });
  await mobileAddress(page);
  await next(page);
  await pickFirstSlot(page);
  await next(page);
  await fillContact(page);
  await page.getByRole("checkbox", { name: /text me confirmations/i }).click();
  await next(page, /continue to review/i);
  await expect(page.getByRole("heading", { name: /review and confirm/i })).toBeVisible();
  await agreeAndPay(page);
  await fakePaySuccess(page);
  await expect(page.getByText(/headlight restoration/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /add to google calendar/i })).toBeVisible();
  const number = await bookingNumber(page);
  const msgs = await outbox(request, number);
  expect(msgs.some((m) => m.template === "booking_confirmed" && m.audience === "customer" && m.type === "email" && m.status === "done")).toBe(true);
  expect(msgs.some((m) => m.template === "owner_booking_confirmed" && m.audience === "owner")).toBe(true);
});

test("E2E-02 SUV and truck multipliers flow through price summary and confirmation", async ({ page }) => {
  await startService(page, { size: "SUV", pkg: "Premium" });
  const summary = page.getByRole("complementary", { name: /booking summary/i }).or(page.getByRole("button", { name: /show booking summary/i }));
  await expect(summary.first()).toBeVisible();
  await mobileAddress(page);
  await next(page);
  await pickFirstSlot(page);
  await next(page);
  await fillContact(page, { email: "suv@example.com" });
  await next(page, /continue to review/i);
  // Premium base 279 × 1.2 = 334.80 → $335
  await expect(page.getByText("$335").first()).toBeVisible();
  await agreeAndPay(page);
  await fakePaySuccess(page);
  await expect(page.getByText("$335").first()).toBeVisible();
});

test("E2E-03 in-shop path shows the shop address and books a bay", async ({ page }) => {
  await startService(page, { pkg: "Basic" });
  await page.getByRole("radio", { name: /at your shop/i }).click();
  await expect(page.getByText(/123 Example Street/).first()).toBeVisible();
  await next(page);
  await pickFirstSlot(page);
  await next(page);
  await fillContact(page, { email: "shop@example.com" });
  await next(page, /continue to review/i);
  await agreeAndPay(page);
  await fakePaySuccess(page);
  await expect(page.getByText(/at our shop|example street/i).first()).toBeVisible();
});

test("E2E-04 address outside the area → friendly block + quote option", async ({ page }) => {
  await startService(page);
  await mobileAddress(page, "99999");
  await next(page);
  await expect(page.getByRole("alert").filter({ hasText: /outside our regular service area/i })).toBeVisible();
  await page.getByRole("button", { name: /request a quote anyway/i }).click();
  await expect(page.getByRole("heading", { name: /describe your job/i })).toBeVisible();
});

test("E2E-05 custom job → photo → quote request saved", async ({ page }) => {
  await page.goto("/quote");
  await page.getByRole("radio", { name: /sedan/i }).click();
  await next(page);
  await page.getByLabel(/job description/i).fill("Paint protection film on the full front end, please quote.");
  await page.locator('input[type="file"]').setInputFiles({ name: "car.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003030200ef9a5cf70000000049454e44ae426082", "hex") });
  await expect(page.getByText(/uploaded/i)).toBeVisible({ timeout: 20_000 });
  await next(page);
  await page.getByRole("radio", { name: /at your shop/i }).click();
  await next(page);
  await fillContact(page, { email: "quote@example.com" });
  await page.getByRole("button", { name: /send quote request/i }).click();
  await expect(page.getByRole("heading", { name: /request received/i })).toBeVisible();
});

test("E2E-06 two users race for the last in-shop slot → one wins, the other sees alternatives", async ({ browser, request }) => {
  const a = await newTab(browser);
  const b = await newTab(browser);
  for (const p of [a, b]) {
    await startService(p, { pkg: "Basic" });
    await p.getByRole("radio", { name: /at your shop/i }).click();
    await next(p);
  }
  // Both tabs must look at the same day: each defaults to its first open day, which can differ
  // once earlier tests have taken slots. Use the last open day in A's visible month.
  const day = a.getByRole("grid").getByRole("button", { disabled: false }).last();
  const dayName = (await day.getAttribute("aria-label"))?.replace(/^Today, /, "").replace(/, selected$/, "") ?? "";
  expect(dayName).not.toBe("");
  for (const p of [a, b]) await p.getByRole("grid").getByRole("button", { name: dayName }).click();
  // Target one start time by name: after a loss the list reloads, and an index-based locator
  // would re-resolve to a different slot if Playwright retried the click.
  const times = a.getByRole("radiogroup", { name: /available times/i }).getByRole("radio");
  await expect(times.first()).toBeVisible();
  const time = /\d{1,2}:\d{2} [AP]M/.exec(await times.last().ariaSnapshot())?.[0];
  expect(time).toBeTruthy();
  const pick = (p: typeof a) => p.getByRole("radiogroup", { name: /available times/i }).getByRole("radio", { name: new RegExp(`^${time}`) });
  await expect(pick(b)).toBeVisible();
  await Promise.all([pick(a).click({ timeout: 5_000 }).catch(() => {}), pick(b).click({ timeout: 5_000 }).catch(() => {})]);
  await expect.poll(async () => (await a.getByText(/someone just booked/i).count()) + (await b.getByText(/someone just booked/i).count())).toBe(1);
  const loser = (await a.getByText(/someone just booked/i).count()) ? a : b;
  const winner = loser === a ? b : a;
  await expect(winner.getByText(/held for you/i)).toBeVisible();
  await expect(loser.getByText(/closest open times/i)).toBeVisible();
  void request;
});

test("E2E-07 slot hold expires → the time becomes available again", async ({ browser, request }) => {
  const a = await newTab(browser);
  await startService(a, { pkg: "Basic" });
  await a.getByRole("radio", { name: /at your shop/i }).click();
  await next(a);
  // Last slot of the day, so advancing the clock can't push it into the past.
  const first = a.getByRole("radiogroup", { name: /available times/i }).getByRole("radio").last();
  // The slot list's legend names the day ("Friday, October 23, 2026"); B selects the same day.
  const legend = (await a.locator("fieldset legend").first().textContent()) ?? "";
  const [, month, dayNum] = /([A-Z][a-z]+) (\d{1,2}),/.exec(legend) ?? [];
  expect(month).toBeTruthy();
  const dayName = new RegExp(`${month} ${dayNum}(st|nd|rd|th),`);
  const time = /\d{1,2}:\d{2} [AP]M/.exec(await first.ariaSnapshot())?.[0] ?? "";
  expect(time).not.toBe("");
  await first.click();
  await expect(a.getByText(/held for you/i)).toBeVisible();
  await advanceClock(request, 11 * 60_000);
  const b = await newTab(browser);
  await startService(b, { pkg: "Basic" });
  await b.getByRole("radio", { name: /at your shop/i }).click();
  await next(b);
  await b.getByRole("grid").getByRole("button", { name: dayName }).click();
  await expect(b.getByRole("radiogroup", { name: /available times/i }).getByRole("radio", { name: new RegExp(`^${time}`) })).toBeVisible();
});

test("E2E-08 declined card / 3DS / closing → no confirmed booking, retry works", async ({ page }) => {
  await startService(page, { pkg: "Basic" });
  await page.getByRole("radio", { name: /at your shop/i }).click();
  await next(page);
  await pickFirstSlot(page);
  await next(page);
  await fillContact(page, { email: "decline@example.com" });
  await next(page, /continue to review/i);
  await agreeAndPay(page);
  await page.getByRole("button", { name: /card declined/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /declined/i })).toBeVisible();
  await expect(page).toHaveURL(/\/book/);
  await page.getByRole("button", { name: /requires 3-d secure/i }).click();
  await page.getByRole("button", { name: /fail authentication/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /authentication failed/i })).toBeVisible();
  await page.getByRole("button", { name: /requires 3-d secure/i }).click();
  await page.getByRole("button", { name: /complete authentication/i }).click();
  await expect(page.getByRole("heading", { name: /you're booked/i })).toBeVisible({ timeout: 30_000 });
});

test("E2E-09 webhook delivered twice → one booking, one confirmation email", async ({ page, request }) => {
  await startService(page, { pkg: "Basic" });
  await page.getByRole("radio", { name: /at your shop/i }).click();
  await next(page);
  await pickFirstSlot(page);
  await next(page);
  await fillContact(page, { email: "twice@example.com" });
  await next(page, /continue to review/i);
  await agreeAndPay(page);
  const panel = page.getByTestId("fake-payment");
  await expect(panel).toBeVisible();
  // Deliver the same event twice through the real webhook route.
  const session = await page.evaluate(() => sessionStorage.getItem("booking.wizard.v1"));
  expect(session).toBeTruthy();
  await page.route("**/api/test/fake-pay", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    await route.continue({ postData: JSON.stringify({ ...body, deliveries: 2 }) });
  });
  await fakePaySuccess(page);
  const number = await bookingNumber(page);
  const msgs = await outbox(request, number);
  expect(msgs.filter((m) => m.template === "booking_confirmed" && m.type === "email")).toHaveLength(1);
});

test("E2E-10 refresh and browser back keep progress", async ({ page }) => {
  await startService(page, { size: "Truck", pkg: "Ultimate" });
  await expect(page.getByRole("heading", { name: /where should we do the work/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /where should we do the work/i })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: /choose your services/i })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Ultimate/i })).toBeChecked();
  await page.goBack();
  await expect(page.getByRole("radio", { name: /truck/i })).toBeChecked();
});

async function bookConfirmed(page: import("@playwright/test").Page, email: string) {
  await startService(page, { pkg: "Basic" });
  await page.getByRole("radio", { name: /at your shop/i }).click();
  await next(page);
  await pickFirstSlot(page);
  await next(page);
  await fillContact(page, { email });
  await next(page, /continue to review/i);
  await agreeAndPay(page);
  await fakePaySuccess(page);
  return bookingNumber(page);
}

test("E2E-11 reschedule via manage link frees the old slot and notifies", async ({ page, request }) => {
  const number = await bookConfirmed(page, "move@example.com");
  await page.getByRole("button", { name: /reschedule/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("group", { name: /available days/i }).getByRole("button").nth(2).click();
  await dialog.getByRole("radiogroup", { name: /available times/i }).getByRole("radio").first().click();
  await dialog.getByRole("button", { name: /move to/i }).click();
  await expect(dialog).toBeHidden();
  const msgs = await outbox(request, number);
  expect(msgs.some((m) => m.template === "booking_rescheduled")).toBe(true);
});

test("E2E-12 cancel outside the window → full refund queued", async ({ page, request }) => {
  const number = await bookConfirmed(page, "cancel@example.com");
  await page.getByRole("button", { name: /cancel booking/i }).click();
  await expect(page.getByText(/full deposit of \$50/i)).toBeVisible();
  await page.getByRole("button", { name: /yes, cancel my booking/i }).click();
  await expect(page.getByRole("heading", { name: /booking cancelled/i })).toBeVisible();
  const msgs = await outbox(request, number);
  expect(msgs.some((m) => m.type === "stripe.refund")).toBe(true);
  expect(msgs.some((m) => m.template === "booking_cancelled")).toBe(true);
});

test("E2E-13 closed days are disabled in the calendar", async ({ page }) => {
  await startService(page, { pkg: "Basic" });
  await page.getByRole("radio", { name: /at your shop/i }).click();
  await next(page);
  // Sunday 2026-10-25 is closed in seed hours.
  await expect(page.getByRole("button", { name: /sunday, october 25/i })).toBeDisabled();
});

test("E2E-14 a job longer than a day routes to a custom quote", async ({ page }) => {
  await startService(page, { pkg: "Ultimate" });
  await expect(page.getByRole("heading", { name: /where should we do the work/i })).toBeVisible();
  await page.goBack();
  await page.getByRole("radio", { name: /no package/i }).click();
  await page.getByRole("checkbox", { name: /paint correction — 2-stage/i }).click();
  await page.getByRole("checkbox", { name: /ceramic coating/i }).click();
  await expect(page.getByText(/longer than a single day/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /switch to a custom quote/i })).toBeVisible();
});

test("E2E-15 invalid inputs show clear errors and block progress", async ({ page }) => {
  await page.goto("/book");
  await next(page);
  await expect(page.getByRole("alert").filter({ hasText: /choose one option/i })).toBeVisible();
  await page.getByRole("radio", { name: /choose a service or package/i }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: /tell us about your vehicle/i })).toBeVisible();
  await next(page);
  await expect(page.getByText(/choose your vehicle size/i)).toBeVisible();
  await page.getByRole("radio", { name: /sedan/i }).click();
  await page.getByLabel(/^year/i).fill("1800");
  await next(page);
  await expect(page.getByText(/enter a year between/i)).toBeVisible();
  await page.getByLabel(/^year/i).fill("");
  await next(page);
  await page.getByRole("radio", { name: /^Basic/i }).click();
  await next(page);
  await page.getByRole("radio", { name: /at your shop/i }).click();
  await next(page);
  await pickFirstSlot(page);
  await next(page);
  await page.getByLabel(/mobile phone/i).fill("12");
  await page.getByLabel(/^email/i).fill("not-an-email");
  await next(page, /continue to review/i);
  await expect(page.getByText(/enter your full name/i)).toBeVisible();
  await expect(page.getByText(/valid phone number/i)).toBeVisible();
  await expect(page.getByText(/valid email address/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /your contact details/i })).toBeVisible();
});

test("E2E-16 deposit disabled → no payment step, booking confirmed", async ({ page, request }) => {
  await request.post("/api/test/settings", { data: { deposit: { mode: "none" } } });
  try {
    await startService(page, { pkg: "Basic" });
    await page.getByRole("radio", { name: /at your shop/i }).click();
    await next(page);
    await pickFirstSlot(page);
    await next(page);
    await fillContact(page, { email: "nodeposit@example.com" });
    await next(page, /continue to review/i);
    await expect(page.getByText(/no payment needed now/i)).toBeVisible();
    await page.getByRole("checkbox", { name: /cancellation policy/i }).click();
    await page.getByRole("button", { name: /confirm booking/i }).click();
    await expect(page.getByRole("heading", { name: /you're booked/i })).toBeVisible();
  } finally {
    await request.post("/api/test/settings", { data: { deposit: { mode: "fixed", valueCents: 5000 } } });
  }
});

test("E2E-17 keyboard-only completion of the full flow", async ({ page }) => {
  await page.goto("/book");
  const tabTo = async (name: RegExp, role: "radio" | "button" | "checkbox" | "textbox" = "button") => {
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      // document.activeElement, not :focus — focus may sit on <body> between steps.
      const hit = await page.evaluate(
        ({ src, flags, r }) => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return false;
          const label = el.getAttribute("aria-label") ?? (el.getAttribute("aria-labelledby") ? document.getElementById(el.getAttribute("aria-labelledby")!)?.textContent : null) ?? (el as HTMLButtonElement).labels?.[0]?.textContent ?? el.closest("label")?.textContent ?? el.textContent ?? "";
          const roleOk = el.getAttribute("role") === r || el.tagName.toLowerCase() === (r === "textbox" ? "input" : r);
          return new RegExp(src, flags).test(label) && roleOk;
        },
        { src: name.source, flags: name.flags, r: role },
      );
      if (hit) return;
    }
    throw new Error(`Could not reach ${name} by keyboard`);
  };
  // Radio groups use roving tabindex (WAI-ARIA): Tab reaches the group, arrow keys pick the option.
  const chooseRadio = async (name: RegExp) => {
    // Wait for the step to render (view transitions keep the old step briefly).
    await page.getByRole("radio", { name }).first().waitFor();
    await tabTo(/./, "radio");
    for (let i = 0; i < 12; i++) {
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const by = el?.getAttribute("aria-labelledby");
        return el?.getAttribute("aria-label") ?? (by ? document.getElementById(by)?.textContent : null) ?? (el as HTMLButtonElement | null)?.labels?.[0]?.textContent ?? el?.closest("label")?.textContent ?? el?.textContent ?? "";
      });
      if (name.test(label)) {
        await page.keyboard.press("Space");
        return;
      }
      const before = await page.evaluateHandle(() => document.activeElement);
      await page.keyboard.press("ArrowDown");
      // WebKit moves focus asynchronously; read the next label only once focus has moved.
      await page.waitForFunction((prev) => document.activeElement !== prev, before, { timeout: 2_000 }).catch(() => {});
    }
    throw new Error(`Could not choose ${name} by keyboard`);
  };
  await chooseRadio(/choose a service or package/i);
  await tabTo(/continue/i);
  await page.keyboard.press("Enter");
  await chooseRadio(/sedan/i);
  await tabTo(/continue/i);
  await page.keyboard.press("Enter");
  await chooseRadio(/basic/i);
  await tabTo(/continue/i);
  await page.keyboard.press("Enter");
  await chooseRadio(/at your shop/i);
  await tabTo(/continue/i);
  await page.keyboard.press("Enter");
  await chooseRadio(/(AM|PM)/);
  await expect(page.getByText(/held for you/i)).toBeVisible();
  await tabTo(/continue/i);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: /your contact details/i }).waitFor();
  await tabTo(/full name/i, "textbox");
  await page.keyboard.type("Kay Board");
  await tabTo(/mobile phone/i, "textbox");
  await page.keyboard.type("(201) 555-0139");
  await tabTo(/^email/i, "textbox");
  await page.keyboard.type("keyboard@example.com");
  await tabTo(/continue to review/i);
  await page.keyboard.press("Enter");
  await tabTo(/cancellation policy/i, "checkbox");
  await page.keyboard.press("Space");
  await tabTo(/continue to payment/i);
  await page.keyboard.press("Enter");
  // The payment panel is loaded on demand; wait for it like a person would.
  await page.getByTestId("fake-payment").waitFor();
  await tabTo(/succeeds/i);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /you're booked/i })).toBeVisible({ timeout: 30_000 });
});
