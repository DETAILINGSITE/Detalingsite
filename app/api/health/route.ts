import { desc, sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

export async function GET() {
  await connection();
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    const [lastCron] = await db.select().from(s.cronRuns).orderBy(desc(s.cronRuns.startedAt)).limit(1);
    return Response.json(
      { ok: true, db: "up", lastCronRun: lastCron?.startedAt ?? null, lastCronError: lastCron?.error ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
