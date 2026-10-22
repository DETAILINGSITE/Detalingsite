/**
 * Admin authentication (Better Auth — see docs/PLAN.md §0 for why not Auth.js/Clerk).
 * Customers never have accounts. Sign-up is disabled; the first owner is created with
 * `pnpm admin:create`.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { business } from "@/config/business";
import { getDb } from "@/db/client";
import { authSchema } from "@/db/schema";
import { env, siteUrl } from "@/lib/env";

function createAuth() {
  const e = env();
  if (!e.BETTER_AUTH_SECRET && e.NODE_ENV === "production" && e.E2E_TEST_MODE !== "1") {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }
  return betterAuth({
    appName: business.name,
    secret: e.BETTER_AUTH_SECRET ?? "dev-only-better-auth-secret-change-me-32chars",
    baseURL: e.BETTER_AUTH_URL ?? siteUrl(),
    basePath: "/api/auth",
    database: drizzleAdapter(getDb(), { provider: "pg", schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "staff", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      customRules: { "/sign-in/email": { window: 900, max: 5 }, "/two-factor/*": { window: 900, max: 10 } },
    },
    advanced: {
      cookiePrefix: "admin",
      useSecureCookies: e.NODE_ENV === "production" && siteUrl().startsWith("https://"),
    },
    plugins: [twoFactor({ issuer: business.name }), nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const g = globalThis as unknown as { __detailingAuth?: Auth };

export function auth(): Auth {
  g.__detailingAuth ??= createAuth();
  return g.__detailingAuth;
}
