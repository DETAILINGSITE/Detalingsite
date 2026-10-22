import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { cronTick } from "@/lib/server/jobs";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!env().CRON_SECRET) return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await cronTick();
  return Response.json({ ok: true, ...result });
}
