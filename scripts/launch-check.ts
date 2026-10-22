/**
 * `pnpm launch-check` — fails while anything that could ship as fake or broken remains:
 * config placeholders, sample reviews/gallery/city pages/prices, missing production
 * keys, test drivers, or an unlicensed 3D model. `--report` prints without failing.
 */
import { and, count, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import "@/config/business";
import { listPlaceholders } from "@/config/placeholder";
import { createDb, createPool } from "@/db/client";
import * as s from "@/db/schema";
import { EnvSchema, usesTestDrivers } from "@/lib/env";
import { OperationalSettingsSchema } from "@/lib/domain/settings";

type Check = { area: string; ok: boolean; detail: string };
const checks: Check[] = [];
const add = (area: string, ok: boolean, detail: string) => checks.push({ area, ok, detail });

// 1. Config placeholders
for (const p of listPlaceholders()) add("config", false, `${p.key}: ${p.hint}`);
if (listPlaceholders().length === 0) add("config", true, "No placeholders left in config/business.ts");

// 2. Environment (production keys)
const env = EnvSchema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)));
if (!env.success) add("env", false, env.error.issues.map((i) => i.path.join(".")).join(", "));
else {
  const e = env.data;
  const need: [string, string | undefined][] = [
    ["NEXT_PUBLIC_SITE_URL (https)", e.NEXT_PUBLIC_SITE_URL.startsWith("https://") ? e.NEXT_PUBLIC_SITE_URL : undefined],
    ["TOKEN_PEPPER", e.TOKEN_PEPPER.startsWith("dev-only") ? undefined : e.TOKEN_PEPPER],
    ["BETTER_AUTH_SECRET", e.BETTER_AUTH_SECRET],
    ["STRIPE_SECRET_KEY", e.STRIPE_SECRET_KEY],
    ["STRIPE_WEBHOOK_SECRET", e.STRIPE_WEBHOOK_SECRET],
    ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", e.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY],
    ["RESEND_API_KEY", e.RESEND_API_KEY],
    ["OWNER_NOTIFY_EMAIL", e.OWNER_NOTIFY_EMAIL],
    ["TURNSTILE_SECRET_KEY", e.TURNSTILE_SECRET_KEY],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", e.NEXT_PUBLIC_TURNSTILE_SITE_KEY],
    ["CRON_SECRET", e.CRON_SECRET],
  ];
  for (const [name, v] of need) add("env", Boolean(v), v ? `${name} set` : `${name} missing`);
  if (e.STRIPE_SECRET_KEY?.startsWith("sk_test_")) add("env", false, "STRIPE_SECRET_KEY is a test key");
  add("env", !usesTestDrivers(e) && e.E2E_TEST_MODE !== "1", "No test drivers / E2E mode enabled");
  add("env", Boolean(e.TWILIO_ACCOUNT_SID), e.TWILIO_ACCOUNT_SID ? "Twilio configured" : "Twilio not configured (SMS disabled — optional)");
  add("env", Boolean(e.S3_BUCKET), e.S3_BUCKET ? "R2 configured" : "R2 not configured (photo uploads disabled — optional)");
}

// 3. 3D model licence
const licence = path.resolve("public/models/LICENSE.txt");
const licenceText = fs.existsSync(licence) ? fs.readFileSync(licence, "utf8") : "";
add("3d", licenceText.length > 0 && !/PLACEHOLDER/i.test(licenceText), licenceText ? (/PLACEHOLDER/i.test(licenceText) ? "Model licence is still the placeholder" : "Model licence present") : "public/models/LICENSE.txt missing");
const model = path.resolve("public/models/car.glb");
if (fs.existsSync(model)) {
  const mb = fs.statSync(model).size / 1024 / 1024;
  add("3d", mb <= 2, `car.glb is ${mb.toFixed(2)} MB (budget 2 MB)`);
} else add("3d", false, "public/models/car.glb missing (hero will show the poster only)");

// 4. Database content
if (process.env.DATABASE_URL) {
  const pool = createPool(process.env.DATABASE_URL, 1);
  const db = createDb(pool);
  try {
    const sample = async (label: string, table: typeof s.testimonials | typeof s.galleryItems | typeof s.cityPages | typeof s.services | typeof s.packages) => {
      const t = table as typeof s.testimonials;
      const [r] = await db.select({ n: count() }).from(t).where(and(eq(t.isPlaceholder, true), "published" in t ? eq(t.published, true) : undefined));
      add("content", (r?.n ?? 0) === 0, `${r?.n ?? 0} sample ${label} still published`);
    };
    await sample("reviews", s.testimonials);
    await sample("gallery items", s.galleryItems);
    await sample("city pages", s.cityPages);
    const [st] = await db.select().from(s.settings).where(eq(s.settings.id, 1));
    const settings = OperationalSettingsSchema.safeParse(st?.data);
    add("content", Boolean(settings.success && settings.data.catalogReviewed), "Owner has ticked “prices reviewed” in Admin → Settings");
    const [owners] = await db.select({ n: count() }).from(s.user).where(eq(s.user.role, "owner"));
    add("admin", (owners?.n ?? 0) > 0, `${owners?.n ?? 0} owner account(s)`);
  } finally {
    await pool.end();
  }
} else add("content", false, "DATABASE_URL not set — content checks skipped");

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? "✔" : "✖"} [${c.area}] ${c.detail}`);
console.log(`\n${failed.length === 0 ? "Ready to launch." : `${failed.length} item(s) to fix before launch.`}`);
if (failed.length && !process.argv.includes("--report")) process.exit(1);
