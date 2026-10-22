/**
 * Vitest global setup: a fresh embedded Postgres 18 for the whole run (real server, real
 * concurrent connections — needed to test the exclusion constraint), migrated once.
 * Set TEST_DATABASE_URL to use an existing database instead.
 */
import fs from "node:fs";
import pg from "pg";
import { connectionString, startEmbeddedPostgres } from "../../scripts/db/embedded";
import { migrate } from "../../scripts/db/migrate";
import { TEST_DB_PORT } from "../../scripts/db/ports";

export default async function setup() {
  let stop = async () => {};
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const dir = "tests/.artifacts/pg-test";
    fs.rmSync(dir, { recursive: true, force: true });
    const db = await startEmbeddedPostgres({ dir, port: TEST_DB_PORT, persistent: false, databases: ["detailing_test"] });
    stop = db.stop;
    url = connectionString(TEST_DB_PORT, "detailing_test");
  }
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  await migrate(pool, undefined, () => {});
  await pool.end();
  process.env.DATABASE_URL = url;
  return async () => {
    await stop();
  };
}
