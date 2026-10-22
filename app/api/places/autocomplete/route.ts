import { z } from "zod";
import { getDb } from "@/db/client";
import { now } from "@/lib/server/clock";
import { loadSettings } from "@/lib/server/data/settings";
import { autocomplete, placesEnabled } from "@/lib/server/places";
import { rateLimit } from "@/lib/server/rate-limit";
import { ipFromRequest } from "@/lib/server/request";

const Query = z.object({ q: z.string().trim().min(3).max(120), session: z.uuid() });

export async function GET(request: Request) {
  if (!placesEnabled()) return Response.json({ enabled: false, suggestions: [] });
  const rl = await rateLimit(getDb(), "places", ipFromRequest(request), now());
  if (!rl.ok) return Response.json({ enabled: true, suggestions: [] }, { status: 429 });
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ enabled: true, suggestions: [] });
  try {
    const settings = await loadSettings(getDb());
    const suggestions = await autocomplete(parsed.data.q, parsed.data.session, settings.base);
    return Response.json({ enabled: true, suggestions }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[places] autocomplete failed", err);
    return Response.json({ enabled: true, suggestions: [], error: true });
  }
}
