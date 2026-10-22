/**
 * Local Postgres for development and tests (docs/PLAN.md §0: "Local/test Postgres").
 *
 * Uses the `embedded-postgres` package, which ships official PostgreSQL 18 binaries
 * (including the btree_gist and citext contrib extensions the schema needs).
 * Production never uses this — it connects to a managed Postgres via DATABASE_URL.
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

export interface EmbeddedDbOptions {
  /** Data directory. Persistent for dev, throwaway for tests. */
  dir: string;
  port: number;
  persistent: boolean;
  databases: string[];
}

export const DB_USER = "detailing";
export const DB_PASSWORD = "detailing-local-only";

export function connectionString(port: number, database: string) {
  return `postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${port}/${database}`;
}

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/**
 * Starts (or reuses, if already listening on `port`) an embedded Postgres cluster
 * and makes sure the requested databases exist. Returns a stop function that is a
 * no-op when an already-running cluster was reused.
 */
export async function startEmbeddedPostgres(opts: EmbeddedDbOptions) {
  if (await portInUse(opts.port)) {
    return { reused: true as const, stop: async () => {} };
  }

  const dir = path.resolve(opts.dir);
  const isFresh = !fs.existsSync(path.join(dir, "PG_VERSION"));

  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: DB_USER,
    password: DB_PASSWORD,
    port: opts.port,
    persistent: opts.persistent,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (err: unknown) => {
      if (process.env.DEBUG_DB) console.error("[embedded-postgres]", err);
    },
  });

  if (isFresh) await pg.initialise();
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  try {
    const { rows } = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database",
    );
    const existing = new Set(rows.map((r) => r.datname));
    for (const name of opts.databases) {
      if (!existing.has(name)) await client.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await client.end();
  }

  return { reused: false as const, stop: () => pg.stop() };
}
