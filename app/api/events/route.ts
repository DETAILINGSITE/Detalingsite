import { z } from "zod";
import { getDb } from "@/db/client";
import { now } from "@/lib/server/clock";
import { FUNNEL_EVENTS, FUNNEL_STEPS, recordFunnel } from "@/lib/server/funnel";
import { rateLimit } from "@/lib/server/rate-limit";
import { ipFromRequest } from "@/lib/server/request";

const Body = z.object({
  sid: z.uuid(),
  event: z.enum(["step_view", "step_complete"] satisfies (typeof FUNNEL_EVENTS)[number][]),
  step: z.enum(FUNNEL_STEPS),
  utm: z.string().max(200).optional(),
});

/** Anonymous funnel beacon (navigator.sendBeacon). No PII accepted. */
export async function POST(request: Request) {
  const db = getDb();
  const rl = await rateLimit(db, "events", ipFromRequest(request), now());
  if (!rl.ok) return new Response(null, { status: 204 });
  let json: unknown;
  try {
    json = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 204 });
  }
  const parsed = Body.safeParse(json);
  if (parsed.success) {
    await recordFunnel(db, { sessionId: parsed.data.sid, event: parsed.data.event, step: parsed.data.step, at: new Date(now()), utmSource: parsed.data.utm });
  }
  return new Response(null, { status: 204 });
}
