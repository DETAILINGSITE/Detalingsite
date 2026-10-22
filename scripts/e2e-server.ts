/**
 * E2E web server: fresh embedded Postgres → migrate → seed → test admin → `next start`
 * with fake payments, captured notifications, local storage, test captcha and test clock.
 * Builds after seeding (cached pages prerender from the DB). SKIP_BUILD=1 reuses .next.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import { connectionString, startEmbeddedPostgres } from "./db/embedded";
import { migrate } from "./db/migrate";
import { E2E_DB_PORT } from "./db/ports";

const dir = "tests/.artifacts/pg-e2e";
fs.rmSync(dir, { recursive: true, force: true });
const db = await startEmbeddedPostgres({ dir, port: E2E_DB_PORT, persistent: false, databases: ["detailing_e2e"] });
const url = connectionString(E2E_DB_PORT, "detailing_e2e");
const pool = new pg.Pool({ connectionString: url, max: 2 });
await migrate(pool, undefined, () => {});
await pool.end();

process.env.DATABASE_URL = url;
const { createDb, createPool } = await import("../db/client");
const { seed } = await import("../db/seed");
const p2 = createPool(url, 2);
const d = createDb(p2);
await seed(d, { reset: true });
// Deterministic settings for E2E: zero lead time; hours Mon–Sat 08:00–18:00.
await p2.query(`UPDATE settings SET data = jsonb_set(jsonb_set(data, '{minLeadHours}', '0'), '{timezone}', '"America/Chicago"') WHERE id = 1`);
const hash = await hashPassword("e2e-admin-password-123");
await p2.query(`INSERT INTO "user"(id,name,email,email_verified,role,two_factor_enabled) VALUES ('e2e-owner','E2E Owner','owner@e2e.test',true,'owner',false) ON CONFLICT DO NOTHING`);
await p2.query(`INSERT INTO account(id,account_id,provider_id,user_id,password) VALUES ('e2e-acc','e2e-owner','credential','e2e-owner',$1) ON CONFLICT DO NOTHING`, [hash]);
await p2.end();

const port = process.env.PORT ?? "3100";
const serverEnv = {
  ...process.env,
  DATABASE_URL: url,
  E2E_TEST_MODE: "1",
  PAYMENTS_DRIVER: "fake",
  NOTIFY_DRIVER: "capture" as const,
  STORAGE_DRIVER: "local",
  CAPTCHA_DRIVER: "test",
  TEST_CLOCK: "1",
  ADMIN_2FA_OPTIONAL: "1",
  TOKEN_PEPPER: "e2e-pepper-0123456789abcdef",
  BETTER_AUTH_SECRET: "e2e-better-auth-secret-0123456789abcdef",
  CRON_SECRET: "e2e-cron",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
};
if (process.env.SKIP_BUILD !== "1") {
  const { execSync } = await import("node:child_process");
  execSync("pnpm build", { stdio: "inherit", env: { ...serverEnv, NODE_ENV: "production" } });
}
const child = spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "next", "start", "-p", process.env.PORT ?? "3100"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...serverEnv, NODE_ENV: "production" },
});
const shutdown = async () => {
  child.kill();
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", async (code) => {
  await db.stop();
  process.exit(code ?? 0);
});
