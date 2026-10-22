import { business } from "@/config/business";
import { getDb } from "@/db/client";
import { buildIcs } from "@/lib/domain/ics";
import { siteUrl } from "@/lib/env";
import { now } from "@/lib/server/clock";
import { findBookingByToken } from "@/lib/server/booking/holds";
import { formatAddress } from "@/lib/server/booking/location";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await findBookingByToken(getDb(), token);
  if (!booking || !["confirmed", "in_progress", "completed", "cancelled"].includes(booking.status)) {
    return new Response("Not found", { status: 404 });
  }
  const services = booking.priceSnapshot.lines
    .filter((l) => ["package", "service", "addon", "quote"].includes(l.kind))
    .map((l) => l.label)
    .join(", ");
  const location =
    booking.locationType === "shop"
      ? [business.shop.address.line1, business.shop.address.city, business.shop.address.region].join(", ")
      : formatAddress(booking.address);
  const ics = buildIcs({
    uid: `${booking.id}@${new URL(siteUrl()).hostname}`,
    start: booking.startsAt,
    end: booking.endsAt,
    stamp: new Date(now()),
    sequence: booking.rescheduleCount,
    status: booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    summary: `${business.name}: ${services}`,
    description: `Booking ${booking.number}. Manage: ${siteUrl()}/booking/${token}`,
    location,
    url: `${siteUrl()}/booking/${token}`,
    organizerName: business.name,
    organizerEmail: business.contact.email,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.number}.ics"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
