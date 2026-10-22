/**
 * Server environment (docs/PLAN.md §8). Parsed once, lazily, with Zod.
 * Every variable here must also appear in .env.example (tests/unit/env.test.ts).
 *
 * Client code must read NEXT_PUBLIC_* variables directly from process.env so Next
 * can inline them; this module is for the server.
 */
import { z } from "zod";

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: optional,
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  TOKEN_PEPPER: z.string().min(16).default("dev-only-pepper-change-me-in-production"),

  BETTER_AUTH_SECRET: optional,
  BETTER_AUTH_URL: optional,

  STRIPE_SECRET_KEY: optional,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,

  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("Bookings <bookings@example.com>"),
  OWNER_NOTIFY_EMAIL: optional,

  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_MESSAGING_SERVICE_SID: optional,
  OWNER_NOTIFY_PHONE: optional,

  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
  TURNSTILE_SECRET_KEY: optional,

  GOOGLE_MAPS_SERVER_KEY: optional,
  NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY: optional,

  S3_ENDPOINT: optional,
  S3_REGION: z.string().default("auto"),
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  S3_BUCKET: optional,

  CRON_SECRET: optional,

  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: optional,
  NEXT_PUBLIC_PLAUSIBLE_SRC: optional,
  NEXT_PUBLIC_GA4_ID: optional,
  NEXT_PUBLIC_META_PIXEL_ID: optional,
  NEXT_PUBLIC_GADS_ID: optional,

  GCAL_ENABLED: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_REFRESH_TOKEN: optional,
  GCAL_CALENDAR_ID: optional,

  // Test-only drivers (refused in production unless E2E_TEST_MODE=1 on a non-Vercel-production host)
  PAYMENTS_DRIVER: z.enum(["stripe", "fake"]).optional(),
  NOTIFY_DRIVER: z.enum(["live", "capture"]).default("live"),
  STORAGE_DRIVER: z.enum(["r2", "local"]).optional(),
  CAPTCHA_DRIVER: z.enum(["turnstile", "test"]).optional(),
  TEST_CLOCK: optional,
  E2E_TEST_MODE: optional,
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  // Treat `FOO=` (empty) the same as unset, as .env.example leaves most keys blank.
  const source = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  const e = parsed.data;
  assertNoTestDriversInProduction(e);
  cached = e;
  return e;
}

/** For tests that mutate process.env. */
export function resetEnvCache() {
  cached = undefined;
}

export function usesTestDrivers(e: Env): boolean {
  return (
    e.PAYMENTS_DRIVER === "fake" ||
    e.NOTIFY_DRIVER === "capture" ||
    e.STORAGE_DRIVER === "local" ||
    e.CAPTCHA_DRIVER === "test" ||
    e.TEST_CLOCK === "1"
  );
}

function assertNoTestDriversInProduction(e: Env) {
  if (!usesTestDrivers(e)) return;
  const isProdDeploy = e.VERCEL_ENV === "production";
  const isProdBuildWithoutE2E = e.NODE_ENV === "production" && e.E2E_TEST_MODE !== "1";
  if (isProdDeploy || isProdBuildWithoutE2E) {
    throw new Error(
      "Test drivers (fake payments, captured notifications, local storage, test captcha or test clock) are not allowed in production.",
    );
  }
}

export const siteUrl = () => env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

export type PaymentsMode = "stripe" | "fake" | "none";
export function paymentsMode(e = env()): PaymentsMode {
  if (e.PAYMENTS_DRIVER === "fake") return "fake";
  if (e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET) return "stripe";
  return "none";
}

export const smsConfigured = (e = env()) =>
  e.NOTIFY_DRIVER === "capture" ||
  Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_MESSAGING_SERVICE_SID);

export const emailConfigured = (e = env()) => e.NOTIFY_DRIVER === "capture" || Boolean(e.RESEND_API_KEY);

export const storageMode = (e = env()): "r2" | "local" | "none" => {
  if (e.STORAGE_DRIVER === "local") return "local";
  if (e.S3_ENDPOINT && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY && e.S3_BUCKET) return "r2";
  return e.NODE_ENV === "production" ? "none" : "local";
};

export const captchaMode = (e = env()): "turnstile" | "test" | "none" => {
  if (e.CAPTCHA_DRIVER === "test") return "test";
  if (e.TURNSTILE_SECRET_KEY) return "turnstile";
  return e.NODE_ENV === "production" ? "none" : "test";
};
