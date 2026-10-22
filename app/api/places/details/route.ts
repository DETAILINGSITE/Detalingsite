import { z } from "zod";
import { getDb } from "@/db/client";
import { now } from "@/lib/server/clock";
import { placeDetails, placesEnabled } from "@/lib/server/places";
import { rateLimit } from "@/lib/server/rate-limit";
import { ipFromRequest } from "@/lib/server/request";

const Query = z.object({ id: z.string().min(10).max(300), session: z.uuid() });

export async function GET(request: Request) {
  if (!placesEnabled()) return Response.json({ address: null });
  const rl = await rateLimit(getDb(), "places", ipFromRequest(request), now());
  if (!rl.ok) return Response.json({ address: null }, { status: 429 });
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ address: null }, { status: 400 });
  try {
    return Response.json({ address: await placeDetails(parsed.data.id, parsed.data.session) });
  } catch (err) {
    console.error("[places] details failed", err);
    return Response.json({ address: null, error: true });
  }
}
