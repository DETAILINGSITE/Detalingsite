import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { toCsv } from "@/lib/domain/csv";
import { AdminAuthError, audit, requireAdmin } from "@/lib/server/admin-guard";
import { formatAddress } from "@/lib/server/booking/location";

export async function GET(request: Request) {
  let admin;
  try {
    admin = await requireAdmin("owner");
  } catch (e) {
    if (e instanceof AdminAuthError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const type = new URL(request.url).searchParams.get("type");
  const db = getDb();
  let csv: string;

  if (type === "bookings") {
    const rows = await db.select({ b: s.bookings, c: s.customers }).from(s.bookings).leftJoin(s.customers, eq(s.customers.id, s.bookings.customerId)).orderBy(desc(s.bookings.startsAt));
    csv = toCsv(rows, [
      { header: "Number", value: (r) => r.b.number },
      { header: "Status", value: (r) => r.b.status },
      { header: "Starts (UTC)", value: (r) => r.b.startsAt },
      { header: "Customer", value: (r) => r.c?.name },
      { header: "Email", value: (r) => r.c?.email },
      { header: "Phone", value: (r) => r.c?.phoneE164 },
      { header: "Location", value: (r) => (r.b.locationType === "shop" ? "Shop" : formatAddress(r.b.address)) },
      { header: "Vehicle", value: (r) => [r.b.vehicleYear, r.b.vehicleMake, r.b.vehicleModel].filter(Boolean).join(" ") },
      { header: "Services", value: (r) => r.b.priceSnapshot.lines.filter((l) => ["package", "service", "addon", "quote"].includes(l.kind)).map((l) => l.label).join("; ") },
      { header: "Total", value: (r) => (r.b.totalCents / 100).toFixed(2) },
      { header: "Deposit", value: (r) => (r.b.depositCents / 100).toFixed(2) },
      { header: "Balance paid", value: (r) => (r.b.balancePaidCents / 100).toFixed(2) },
      { header: "Source", value: (r) => r.b.attribution.utmSource ?? r.b.heardAbout ?? "" },
      { header: "Created (UTC)", value: (r) => r.b.createdAt },
    ]);
  } else if (type === "customers") {
    const rows = await db.select().from(s.customers).orderBy(desc(s.customers.createdAt));
    csv = toCsv(rows, [
      { header: "Name", value: (r) => r.name },
      { header: "Email", value: (r) => r.email },
      { header: "Phone", value: (r) => r.phoneE164 },
      { header: "Preferred contact", value: (r) => r.preferredContact },
      { header: "SMS consent", value: (r) => r.smsConsentAt },
      { header: "SMS opt-out", value: (r) => r.smsOptOutAt },
      { header: "Created (UTC)", value: (r) => r.createdAt },
    ]);
  } else if (type === "leads") {
    const rows = await db.select().from(s.leads).orderBy(desc(s.leads.createdAt));
    csv = toCsv(rows, [
      { header: "Created (UTC)", value: (r) => r.createdAt },
      { header: "Source", value: (r) => r.source },
      { header: "Status", value: (r) => r.status },
      { header: "Name", value: (r) => r.name },
      { header: "Email", value: (r) => r.email },
      { header: "Phone", value: (r) => r.phoneE164 },
      { header: "Message", value: (r) => r.message },
      { header: "UTM source", value: (r) => r.attribution.utmSource },
      { header: "Referrer", value: (r) => r.attribution.referrer },
    ]);
  } else if (type === "payments") {
    const rows = await db.select({ p: s.payments, n: s.bookings.number }).from(s.payments).innerJoin(s.bookings, eq(s.bookings.id, s.payments.bookingId)).orderBy(desc(s.payments.createdAt));
    csv = toCsv(rows, [
      { header: "Date (UTC)", value: (r) => r.p.createdAt },
      { header: "Booking", value: (r) => r.n },
      { header: "Kind", value: (r) => r.p.kind },
      { header: "Method", value: (r) => r.p.method },
      { header: "Status", value: (r) => r.p.status },
      { header: "Amount", value: (r) => ((r.p.kind === "refund" ? -1 : 1) * r.p.amountCents / 100).toFixed(2) },
      { header: "Stripe ref", value: (r) => r.p.stripePaymentIntentId ?? r.p.stripeRefundId },
    ]);
  } else {
    return new Response("Unknown export", { status: 400 });
  }

  await audit(admin, "export", type, null);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
