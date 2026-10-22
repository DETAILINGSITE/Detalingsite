/**
 * Database access. App code calls `getDb()`; scripts and tests build their own pool
 * with `createDb()` so nothing here depends on Next.js.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export function createPool(connectionString: string, max = 10) {
  return new pg.Pool({
    connectionString,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Managed providers (Neon, DO, RDS) require TLS; local embedded Postgres doesn't.
    ssl: /sslmode=(require|verify-full|verify-ca)/.test(connectionString)
      ? { rejectUnauthorized: !/sslmode=require/.test(connectionString) }
      : undefined,
  });
}

export function createDb(pool: pg.Pool) {
  return drizzle({ client: pool, schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything that can run queries: the db itself or a transaction. */
export type Queryable = Db | Tx;

const globalForDb = globalThis as unknown as { __detailingPool?: pg.Pool; __detailingDb?: Db };

export function getPool(): pg.Pool {
  if (!globalForDb.__detailingPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm dev:db` and copy the URL into .env.");
    globalForDb.__detailingPool = createPool(url);
  }
  return globalForDb.__detailingPool;
}

export function getDb(): Db {
  if (!globalForDb.__detailingDb) globalForDb.__detailingDb = createDb(getPool());
  return globalForDb.__detailingDb;
}

/** Postgres SQLSTATE for an exclusion-constraint violation (overlapping allocation). */
export const EXCLUSION_VIOLATION = "23P01";
export const UNIQUE_VIOLATION = "23505";

export function pgErrorCode(err: unknown): string | undefined {
  let e: unknown = err;
  // Drizzle wraps driver errors; walk the cause chain.
  for (let i = 0; i < 4 && e; i++) {
    if (typeof e === "object" && e && "code" in e && typeof (e as { code: unknown }).code === "string") {
      const code = (e as { code: string }).code;
      if (/^[0-9A-Z]{5}$/.test(code)) return code;
    }
    e = (e as { cause?: unknown })?.cause;
  }
  return undefined;
}

export function pgConstraint(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if (typeof e === "object" && e && "constraint" in e) return (e as { constraint?: string }).constraint;
    e = (e as { cause?: unknown })?.cause;
  }
  return undefined;
}
