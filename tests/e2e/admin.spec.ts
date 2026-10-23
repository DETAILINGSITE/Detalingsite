/** Admin E2E: auth guard, booking visible in admin (scenario 1 end), status changes, CSV. */
import { expect, test } from "@playwright/test";
import { agreeAndPay, bookingNumber, closeTabs, fakePaySuccess, fillContact, newTab, next, pickFirstSlot, setClock, startService } from "./helpers";

test.beforeEach(async ({ request }) => setClock(request));
test.afterEach(closeTabs);

test("E2E-ADMIN-AUTH admin pages and exports require a session", async ({ page, request }) => {
  await page.goto("/admin/bookings");
  await expect(page).toHaveURL(/\/admin\/login/);
  const csv = await request.get("/api/admin/export?type=bookings");
  expect(csv.status()).toBe(403);
});

test("E2E-ADMIN-BOOKINGS a confirmed booking appears in admin and can be completed; CSV export @smoke", async ({ page, browser }) => {
  await startService(page, { pkg: "Basic" });
  await page.getByRole("radio", { name: /at your shop/i }).click();
  await next(page);
  await pickFirstSlot(page);
  await next(page);
  await fillContact(page, { email: "admincheck@example.com" });
  await next(page, /continue to review/i);
  await agreeAndPay(page);
  await fakePaySuccess(page);
  const number = await bookingNumber(page);

  const admin = await newTab(browser);
  await admin.goto("/admin/login");
  await admin.getByLabel(/^email/i).fill("owner@e2e.test");
  await admin.getByLabel(/^password/i).fill("e2e-admin-password-123");
  await admin.getByRole("button", { name: /sign in/i }).click();
  await expect(admin.getByRole("heading", { name: /overview/i })).toBeVisible();
  await admin.goto(`/admin/bookings?q=${number}`);
  await admin.getByRole("link", { name: number }).click();
  await expect(admin.getByRole("heading", { name: new RegExp(number) })).toBeVisible();
  await admin.getByRole("button", { name: /mark completed/i }).click();
  await expect(admin.getByText(/completed/i).first()).toBeVisible();
  await admin.goto("/admin/calendar");
  await expect(admin.getByRole("region", { name: /schedule/i })).toBeVisible();
  const csv = await admin.request.get("/api/admin/export?type=bookings");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(number);
});
