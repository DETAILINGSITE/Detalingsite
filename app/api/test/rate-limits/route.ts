/**
 * Test-only: clear rate-limit counters. E2E tests all come from one IP and pin the clock to the
 * same instant, so windows never roll over. Limits themselves are covered by integration tests.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notFound, testEndpointsEnabled } from "@/lib/server/test-mode";

export async function DELETE() {
  if (!testEndpointsEnabled()) return notFound();
  await getDb().execute(sql`DELETE FROM rate_limits`);
  return Response.json({ ok: true });
}
