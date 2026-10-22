"use server";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { now } from "@/lib/server/clock";
import { getAvailability } from "@/lib/server/booking/availability-service";
import { bookingStatusForToken } from "@/lib/server/booking/checkout";
import { findBookingByToken } from "@/lib/server/booking/holds";
import { cancelBooking, previewCancellation, rescheduleBooking } from "@/lib/server/booking/manage";
import { flushOutbox } from "@/lib/server/jobs";
import { rateLimit } from "@/lib/server/rate-limit";
import { CancelSchema, RescheduleSchema, TokenSchema } from "@/lib/validation/actions";

const NOT_FOUND = { ok: false as const, message: "This link is invalid or has expired." };

async function limited(token: string) {
  const r = await rateLimit(getDb(), "manage", token, now());
  return r.ok ? null : { ok: false as const, message: "Too many changes — please call us." };
}

export async function bookingStatusAction(raw: unknown) {
  const p = TokenSchema.safeParse(raw);
  if (!p.success) return null;
  const s = await bookingStatusForToken(p.data.token);
  return s ? { status: s.status } : null;
}

export async function manageAvailabilityAction(raw: unknown) {
  const p = TokenSchema.extend({ from: z.iso.date().optional() }).safeParse(raw);
  if (!p.success) return NOT_FOUND;
  const booking = await findBookingByToken(getDb(), p.data.token);
  if (!booking || booking.status !== "confirmed") return NOT_FOUND;
  return getAvailability(
    {
      selection: booking.selection,
      locationType: booking.locationType,
      zip: booking.address?.postalCode ?? null,
      lat: booking.address?.lat ?? null,
      lng: booking.address?.lng ?? null,
      fromDate: p.data.from,
      days: 42,
      excludeBookingId: booking.id,
      durationOverrideMin: booking.durationMin,
      quoteToken: null,
    },
    new Date(now()),
  );
}

export async function rescheduleAction(raw: unknown) {
  const p = RescheduleSchema.safeParse(raw);
  if (!p.success) return NOT_FOUND;
  const rl = await limited(p.data.token);
  if (rl) return rl;
  const booking = await findBookingByToken(getDb(), p.data.token);
  if (!booking) return NOT_FOUND;
  const res = await rescheduleBooking(booking, p.data.slotStart, { kind: "customer" }, new Date(now()));
  after(() => flushOutbox().catch((e) => console.error(e)));
  if (res.ok) return { ok: true as const, startsAt: res.startsAt };
  return { ok: false as const, message: "reason" in res ? res.reason : res.message };
}

export async function cancelPreviewAction(raw: unknown) {
  const p = TokenSchema.safeParse(raw);
  if (!p.success) return NOT_FOUND;
  const booking = await findBookingByToken(getDb(), p.data.token);
  if (!booking || booking.status !== "confirmed") return NOT_FOUND;
  const o = await previewCancellation(booking, "customer", new Date(now()));
  return { ok: true as const, ...o };
}

export async function cancelAction(raw: unknown) {
  const p = CancelSchema.safeParse(raw);
  if (!p.success) return NOT_FOUND;
  const rl = await limited(p.data.token);
  if (rl) return rl;
  const booking = await findBookingByToken(getDb(), p.data.token);
  if (!booking) return NOT_FOUND;
  const res = await cancelBooking(booking, { actor: "customer", reason: p.data.reason }, new Date(now()));
  after(() => flushOutbox().catch((e) => console.error(e)));
  return res.ok ? { ok: true as const, refundCents: res.refundCents, feeCents: res.feeCents } : { ok: false as const, message: res.message };
}
