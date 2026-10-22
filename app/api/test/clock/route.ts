import { z } from "zod";
import { getClockOffset, now, setClockOffset, setClockTo } from "@/lib/server/clock";
import { notFound, testEndpointsEnabled } from "@/lib/server/test-mode";

const Body = z.union([z.object({ to: z.iso.datetime({ offset: true }) }), z.object({ offsetMs: z.number() }), z.object({ advanceMs: z.number() })]);

export async function GET() {
  if (!testEndpointsEnabled()) return notFound();
  return Response.json({ now: new Date(now()).toISOString(), offsetMs: getClockOffset() });
}

export async function POST(request: Request) {
  if (!testEndpointsEnabled()) return notFound();
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "bad body" }, { status: 400 });
  const b = parsed.data;
  if ("to" in b) setClockTo(Date.parse(b.to));
  else if ("offsetMs" in b) setClockOffset(b.offsetMs);
  else setClockOffset(getClockOffset() + b.advanceMs);
  return Response.json({ now: new Date(now()).toISOString(), offsetMs: getClockOffset() });
}
