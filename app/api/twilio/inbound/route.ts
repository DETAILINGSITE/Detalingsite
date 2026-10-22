/**
 * Inbound SMS webhook. Twilio Advanced Opt-Out already handles STOP/HELP replies;
 * we mirror opt-outs into the customer record so we never queue texts to them.
 */
import { eq, isNull, and } from "drizzle-orm";
import twilio from "twilio";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { env, siteUrl } from "@/lib/env";
import { now } from "@/lib/server/clock";

const STOP = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|revoke|optout)\s*$/i;
const START = /^\s*(start|unstop|yes)\s*$/i;

export async function POST(request: Request) {
  const token = env().TWILIO_AUTH_TOKEN;
  if (!token) return new Response("Not configured", { status: 503 });
  const form = await request.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!twilio.validateRequest(token, signature, `${siteUrl()}/api/twilio/inbound`, params)) {
    return new Response("Invalid signature", { status: 403 });
  }
  const from = params.From ?? "";
  const body = params.Body ?? "";
  const db = getDb();
  if (STOP.test(body)) {
    await db
      .update(s.customers)
      .set({ smsOptOutAt: new Date(now()) })
      .where(and(eq(s.customers.phoneE164, from), isNull(s.customers.smsOptOutAt)));
  } else if (START.test(body)) {
    await db.update(s.customers).set({ smsOptOutAt: null }).where(eq(s.customers.phoneE164, from));
  }
  // Empty TwiML: Twilio's opt-out handling sends the compliant auto-reply.
  return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
