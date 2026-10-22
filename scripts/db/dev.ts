/**
 * `pnpm dev:db` — runs a persistent local Postgres 18 (data in .data/pg), applies
 * migrations, and stays in the foreground until Ctrl+C.
 */
import pg from "pg";
import { DEV_DB_PORT } from "./ports";
import { connectionString, startEmbeddedPostgres } from "./embedded";
import { migrate } from "./migrate";

const DB_NAME = "detailing";

const db = await startEmbeddedPostgres({
  dir: ".data/pg",
  port: DEV_DB_PORT,
  persistent: true,
  databases: [DB_NAME],
});

const url = connectionString(DEV_DB_PORT, DB_NAME);
const pool = new pg.Pool({ connectionString: url, max: 1 });
await migrate(pool);
await pool.end();

console.log(`\nPostgres is ${db.reused ? "already running" : "running"}.`);
console.log(`DATABASE_URL=${url}\n`);

if (db.reused) process.exit(0);

console.log("Press Ctrl+C to stop.");
const shutdown = async () => {
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
