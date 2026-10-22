/**
 * Optional one-way sync of confirmed bookings to the owner's Google Calendar
 * (flag: business.flags.googleCalendarSync). Uses the REST API directly with an
 * OAuth refresh token — no googleapis dependency.
 */
import { eq } from "drizzle-orm";
import { business } from "@/config/business";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { env, siteUrl } from "@/lib/env";
import type { HandlerResult } from "../outbox";
import { formatAddress } from "../booking/location";

async function accessToken(): Promise<string | null> {
  const e = env();
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET || !e.GOOGLE_REFRESH_TOKEN) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID,
      client_secret: e.GOOGLE_CLIENT_SECRET,
      refresh_token: e.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Deterministic event id (base32hex, 5–1024 chars) so upserts are idempotent. */
function eventId(bookingId: string) {
  return `bk${bookingId.replace(/-/g, "")}`;
}

export async function syncCalendar(db: Db, bookingId: string, action: "upsert" | "delete"): Promise<HandlerResult> {
  if (!business.flags.googleCalendarSync || env().GCAL_ENABLED !== "1") return { status: "skipped" };
  const token = await accessToken();
  const calendarId = env().GCAL_CALENDAR_ID ?? "primary";
  if (!token) return { status: "skipped", payloadPatch: { skipReason: "Google credentials missing" } };
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  if (action === "delete") {
    const res = await fetch(`${base}/${eventId(bookingId)}`, { method: "DELETE", headers });
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`GCal delete ${res.status}`);
    return { status: "done" };
  }
  const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, bookingId));
  if (!b) return { status: "skipped" };
  const body = {
    id: eventId(b.id),
    summary: `${b.number} — ${b.priceSnapshot.lines.filter((l) => ["package", "service", "quote"].includes(l.kind)).map((l) => l.label).join(", ")}`,
    location: b.locationType === "mobile" ? formatAddress(b.address) : "Shop",
    description: `${siteUrl()}/admin/bookings/${b.id}`,
    start: { dateTime: b.startsAt.toISOString() },
    end: { dateTime: b.endsAt.toISOString() },
  };
  let res = await fetch(`${base}/${body.id}`, { method: "PUT", headers, body: JSON.stringify(body) });
  if (res.status === 404) res = await fetch(base, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GCal upsert ${res.status}`);
  return { status: "done" };
}
