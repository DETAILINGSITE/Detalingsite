import { z } from "zod";
import { getDb } from "@/db/client";
import { getAvailability } from "@/lib/server/booking/availability-service";
import { now } from "@/lib/server/clock";
import { rateLimit } from "@/lib/server/rate-limit";
import { ipFromRequest } from "@/lib/server/request";

const list = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").filter(Boolean).slice(0, 20) : []));

const Query = z.object({
  size: z.string().min(1).max(64),
  pkg: z.string().max(64).optional(),
  svc: list,
  add: list,
  cond: list,
  loc: z.enum(["mobile", "shop"]),
  zip: z.string().regex(/^\d{5}$/).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  from: z.iso.date().optional(),
  days: z.coerce.number().int().min(1).max(62).optional(),
  quote: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
});

export async function GET(request: Request) {
  const ip = ipFromRequest(request);
  const rl = await rateLimit(getDb(), "availability", ip, now());
  if (!rl.ok) return Response.json({ ok: false, code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ ok: false, code: "VALIDATION", message: "Invalid query" }, { status: 400 });
  const q = parsed.data;
  if (q.loc === "mobile" && !q.zip && !q.quote)
    return Response.json({ ok: false, code: "VALIDATION", message: "ZIP code required for mobile service" }, { status: 400 });

  const result = await getAvailability(
    {
      selection: { sizeId: q.size, packageId: q.pkg ?? null, serviceIds: q.svc, addonIds: q.add, conditionIds: q.cond },
      locationType: q.loc,
      zip: q.zip,
      lat: q.lat,
      lng: q.lng,
      fromDate: q.from,
      days: q.days,
      quoteToken: q.quote,
    },
    new Date(now()),
  );
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
