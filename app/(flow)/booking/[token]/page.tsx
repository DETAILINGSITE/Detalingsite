import { CalendarPlus, CheckCircle2, XCircle } from "lucide-react";
import { inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { business } from "@/config/business";
import { ConfirmationPoller } from "@/components/booking/manage/confirmation-poller";
import { ManageActions } from "@/components/booking/manage/manage-actions";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { STATUS_LABELS } from "@/lib/domain/booking-state";
import { googleCalendarUrl } from "@/lib/domain/ics";
import { emailConfigured } from "@/lib/env";
import { formatDuration, formatMoney } from "@/lib/domain/money";
import { canReschedule } from "@/lib/domain/policy";
import { formatDateTimeLong } from "@/lib/domain/time";
import { now } from "@/lib/server/clock";
import { findBookingByToken } from "@/lib/server/booking/holds";
import { formatAddress } from "@/lib/server/booking/location";
import { loadSettings } from "@/lib/server/data/settings";
import { siteUrl } from "@/lib/env";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Your booking", description: "View, reschedule or cancel your booking.", path: "/booking", noindex: true });

export default async function BookingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  await connection();
  const { token } = await params;
  const { new: isNew } = await searchParams;
  const db = getDb();
  const booking = await findBookingByToken(db, token);
  if (!booking || booking.status === "held") notFound();
  const settings = await loadSettings(db);
  const at = now();

  if (booking.status === "pending_payment") {
    return (
      <div className="container-site max-w-2xl py-16">
        <h1 className="mb-6 text-3xl font-bold">Almost there</h1>
        <ConfirmationPoller token={token} />
      </div>
    );
  }
  if (booking.status === "expired") {
    return (
      <div className="container-site max-w-2xl py-16">
        <div className="card flex flex-col gap-4 p-8">
          <XCircle className="size-9 text-warning" aria-hidden="true" />
          <h1 className="text-3xl font-bold">This booking wasn't completed</h1>
          <p className="text-fg-muted">The time hold expired before the booking was finished. If you were charged, the deposit has been refunded automatically.</p>
          <Link href="/book" className={buttonVariants() + " w-fit"}>Book again</Link>
        </div>
      </div>
    );
  }

  const serviceIds = booking.priceSnapshot.resolvedServiceIds ?? [];
  const services = serviceIds.length ? await db.select().from(s.services).where(inArray(s.services.id, serviceIds)) : [];
  const checklist = [...new Set(services.flatMap((x) => x.whatToExpect))];
  const lines = booking.priceSnapshot.lines.filter((l) => ["package", "service", "addon", "quote"].includes(l.kind));
  const where = booking.locationType === "shop" ? `${business.shop.address.line1}, ${business.shop.address.city}` : formatAddress(booking.address);
  const summary = `${business.name}: ${lines.map((l) => l.label).join(", ")}`;
  const gcal = googleCalendarUrl({ start: booking.startsAt, end: booking.endsAt, summary, location: where, description: `Booking ${booking.number}. ${siteUrl()}/booking/${token}` });
  const resched = canReschedule({ startsAt: booking.startsAt.getTime(), now: at, count: booking.rescheduleCount, status: booking.status, policy: settings.reschedule, actor: "customer" });
  const cancelled = booking.status === "cancelled";
  const balance = booking.totalCents - booking.depositCents - booking.balancePaidCents;

  return (
    <div className="container-site grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          {cancelled ? <XCircle className="size-10 text-danger" aria-hidden="true" /> : <CheckCircle2 className="size-10 text-success" aria-hidden="true" />}
          <h1 className="text-[clamp(2rem,4vw,3rem)] leading-tight font-extrabold">
            {cancelled ? "Booking cancelled" : isNew ? "You're booked!" : "Your booking"}
          </h1>
          <p className="text-lg text-fg-muted">
            Booking <strong className="text-fg">{booking.number}</strong> · {STATUS_LABELS[booking.status]}
          </p>
          {isNew && !cancelled && (
            <p className="text-fg-muted">
              {emailConfigured() ? "We've emailed your confirmation." : `We'll contact you to confirm. Questions? Call ${business.contact.phoneDisplay}.`} Save this page to manage your booking.
            </p>
          )}
        </div>

        <dl className="card grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-fg-subtle">When</dt>
            <dd className="font-semibold">{formatDateTimeLong(booking.startsAt.getTime(), booking.timezone)}</dd>
          </div>
          <div>
            <dt className="text-sm text-fg-subtle">Where</dt>
            <dd className="font-semibold">{where}</dd>
          </div>
          <div>
            <dt className="text-sm text-fg-subtle">Vehicle</dt>
            <dd className="font-semibold">{[booking.vehicleYear, booking.vehicleMake, booking.vehicleModel].filter(Boolean).join(" ") || booking.priceSnapshot.sizeLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-fg-subtle">Estimated time</dt>
            <dd className="font-semibold">{formatDuration(booking.durationMin)}</dd>
          </div>
        </dl>

        {!cancelled && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={`/booking/${token}/calendar.ics`} className={buttonVariants({ variant: "secondary" })} download>
              <CalendarPlus aria-hidden="true" /> Add to calendar (.ics)
            </a>
            <a href={gcal} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
              Add to Google Calendar
            </a>
          </div>
        )}

        {!cancelled && checklist.length > 0 && (
          <section aria-labelledby="expect" className="flex flex-col gap-3">
            <h2 id="expect" className="text-xl font-bold">What to expect</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-fg-muted">
              {checklist.map((c) => (
                <li key={c}>{c}</li>
              ))}
              {booking.locationType === "mobile" && <li>Please make sure we can reach the vehicle and that personal items are removed.</li>}
            </ul>
          </section>
        )}

        {booking.status === "confirmed" && (
          <section aria-labelledby="changes" className="flex flex-col gap-3">
            <h2 id="changes" className="text-xl font-bold">Need to make a change?</h2>
            <ManageActions
              token={token}
              timezone={booking.timezone}
              canReschedule={resched.ok}
              rescheduleNote={
                resched.ok
                  ? null
                  : resched.reason === "too_late"
                    ? `Online changes close ${settings.reschedule.minHoursBefore} hours before your appointment — call ${business.contact.phoneDisplay}.`
                    : `Please call ${business.contact.phoneDisplay} to change this booking.`
              }
            />
          </section>
        )}
        {cancelled && (booking.refundCents ?? 0) > 0 && (
          <p className="text-fg-muted">A refund of {formatMoney(booking.refundCents ?? 0)} is on its way to your card (usually 5–10 business days).</p>
        )}
      </div>

      <aside aria-label="Price breakdown" className="card self-start p-6">
        <h2 className="mb-4 text-lg font-bold">Price</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {booking.priceSnapshot.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-fg-muted">{l.label}</span>
              <span className="tabular">{l.amountCents < 0 ? `−${formatMoney(-l.amountCents)}` : formatMoney(l.amountCents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-1.5 border-t border-white/[0.08] pt-4 text-sm">
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular">{formatMoney(booking.totalCents)}</span>
          </div>
          {booking.depositCents > 0 && (
            <div className="flex justify-between text-fg-muted">
              <span>Deposit paid</span>
              <span className="tabular">{formatMoney(booking.depositCents)}</span>
            </div>
          )}
          {!cancelled && (
            <div className="flex justify-between text-fg-muted">
              <span>Balance due at appointment</span>
              <span className="tabular">{formatMoney(Math.max(0, balance))}</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
