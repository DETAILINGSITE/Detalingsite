/**
 * Message content for every email/SMS. Pure: given loaded records, returns copy.
 * The email layout (emails/branded-email.tsx) renders `MessageContent`.
 */
import { business } from "@/config/business";
import type * as s from "@/db/schema";
import { formatDuration, formatMoney } from "@/lib/domain/money";
import { formatDateTimeLong } from "@/lib/domain/time";
import { formatPhoneForDisplay } from "@/lib/validation/booking";
import { formatAddress } from "../booking/location";
import type { Audience, EmailTemplate } from "./enqueue";

type Booking = typeof s.bookings.$inferSelect;
type Customer = typeof s.customers.$inferSelect;
type Quote = typeof s.quoteRequests.$inferSelect;
type Lead = typeof s.leads.$inferSelect;

export interface MessageContent {
  subject: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  details: { label: string; value: string }[];
  checklist?: string[];
  cta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  sms: string;
}

export interface MessageInput {
  template: EmailTemplate;
  audience: Audience;
  siteUrl: string;
  booking?: Booking | null;
  customer?: Customer | null;
  quote?: Quote | null;
  lead?: Lead | null;
  manageUrl?: string | null;
  quoteUrl?: string | null;
  serviceNames?: string[];
  whatToExpect?: string[];
  data?: Record<string, unknown>;
}

const money = (c: number) => formatMoney(c, business.currency, business.locale);

function when(b: Booking) {
  return formatDateTimeLong(b.startsAt.getTime(), b.timezone, business.locale);
}

function where(b: Booking) {
  if (b.locationType === "shop") {
    const a = business.shop.address;
    return `At our shop — ${a.line1}, ${a.city}`;
  }
  return formatAddress(b.address);
}

function vehicle(b: Booking) {
  const parts = [b.vehicleYear, b.vehicleMake, b.vehicleModel].filter(Boolean).join(" ");
  return parts || b.priceSnapshot.sizeLabel;
}

function bookingDetails(b: Booking, serviceNames: string[] = []) {
  const balance = b.totalCents - b.depositCents - b.balancePaidCents;
  return [
    { label: "Booking number", value: b.number },
    { label: "When", value: when(b) },
    { label: "Where", value: where(b) },
    { label: "Vehicle", value: vehicle(b) },
    ...(serviceNames.length ? [{ label: "Services", value: serviceNames.join(", ") }] : []),
    { label: "Estimated time", value: formatDuration(b.durationMin) },
    { label: "Total", value: money(b.totalCents) },
    ...(b.depositCents > 0 ? [{ label: "Deposit paid", value: money(b.depositCents) }] : []),
    { label: "Balance due at the appointment", value: money(Math.max(0, balance)) },
  ];
}

const sig = `— ${business.name}`;

export function buildMessage(input: MessageInput): MessageContent {
  const { template, booking: b, customer: c, quote: q, lead } = input;
  const first = c?.name.split(" ")[0] ?? "there";
  const services = input.serviceNames ?? [];

  switch (template) {
    case "booking_confirmed": {
      if (!b) throw new Error("booking required");
      return {
        subject: `You're booked — ${when(b)} (${b.number})`,
        preview: `Your ${business.name} appointment is confirmed.`,
        heading: `You're booked, ${first}!`,
        paragraphs: [
          "Thanks for booking with us. Your appointment is confirmed — here are the details.",
          "Need to make a change? Use the button below to reschedule or cancel.",
        ],
        details: bookingDetails(b, services),
        checklist: input.whatToExpect?.length ? input.whatToExpect : undefined,
        cta: input.manageUrl ? { label: "View or change booking", href: input.manageUrl } : undefined,
        sms: `${business.name}: You're booked for ${when(b)} (${b.number}). Manage: ${input.manageUrl ?? input.siteUrl} Reply STOP to opt out.`,
      };
    }
    case "booking_reminder": {
      if (!b) throw new Error("booking required");
      const h = Number(input.data?.hoursBefore ?? 24);
      const soon = h <= 3 ? "soon" : "tomorrow";
      return {
        subject: `Reminder: your detail is ${soon} — ${when(b)}`,
        preview: `See you ${soon}!`,
        heading: `See you ${soon}, ${first}`,
        paragraphs: [
          b.locationType === "mobile"
            ? "Please make sure the vehicle is accessible and personal items are removed."
            : "Please bring the vehicle to our shop at your appointment time.",
        ],
        details: bookingDetails(b, services).slice(0, 4),
        cta: input.manageUrl ? { label: "View or change booking", href: input.manageUrl } : undefined,
        sms: `${business.name} reminder: ${when(b)}. Manage: ${input.manageUrl ?? input.siteUrl} Reply STOP to opt out.`,
      };
    }
    case "booking_rescheduled": {
      if (!b) throw new Error("booking required");
      return {
        subject: `Booking moved to ${when(b)} (${b.number})`,
        preview: "Your appointment time has changed.",
        heading: "Your booking has been moved",
        paragraphs: ["Your appointment now takes place at the time below. Your previous time has been released."],
        details: bookingDetails(b, services),
        cta: input.manageUrl ? { label: "View booking", href: input.manageUrl } : undefined,
        sms: `${business.name}: your booking ${b.number} is now ${when(b)}. ${input.manageUrl ?? ""} Reply STOP to opt out.`,
      };
    }
    case "booking_cancelled": {
      if (!b) throw new Error("booking required");
      const refund = b.refundCents ?? 0;
      return {
        subject: `Booking ${b.number} cancelled`,
        preview: "Your booking has been cancelled.",
        heading: "Your booking is cancelled",
        paragraphs: [
          `We've cancelled booking ${b.number} for ${when(b)}.`,
          refund > 0
            ? `A refund of ${money(refund)} is on its way to your card and usually appears within 5–10 business days.`
            : (b.cancellationFeeCents ?? 0) > 0
              ? `Per our cancellation policy, ${money(b.cancellationFeeCents ?? 0)} of your deposit was kept and isn't refunded.`
              : "No payment was taken.",
          "We'd love to see you another time.",
        ],
        details: [],
        cta: { label: "Book again", href: `${input.siteUrl}/book` },
        sms: `${business.name}: booking ${b.number} is cancelled.${refund > 0 ? ` Refund: ${money(refund)}.` : ""}`,
      };
    }
    case "late_payment_refunded": {
      if (!b) throw new Error("booking required");
      return {
        subject: `We've refunded your deposit (${b.number})`,
        preview: "Your payment arrived after the time was released.",
        heading: "Sorry — that time was no longer available",
        paragraphs: [
          `Your payment for ${when(b)} reached us after your hold had expired, and someone else had booked that time in the meantime.`,
          `We've refunded the full ${money(b.depositCents)} automatically. Please pick another time — or reply and we'll find one for you.`,
        ],
        details: [],
        cta: { label: "Choose another time", href: `${input.siteUrl}/book` },
        sms: `${business.name}: sorry, ${when(b)} was taken before your payment arrived. Your deposit has been refunded in full. Rebook: ${input.siteUrl}/book`,
      };
    }
    case "review_request": {
      if (!b) throw new Error("booking required");
      return {
        subject: `How did we do, ${first}?`,
        preview: "A quick review helps a small business a lot.",
        heading: "Thanks for choosing us",
        paragraphs: [
          "We hope your car looks and feels fantastic. If you have a minute, an honest review helps other drivers find us.",
          "If anything wasn't right, just reply to this email — we'll make it right.",
        ],
        details: [],
        cta: { label: "Leave a review", href: business.links.googleReviews },
        sms: `${business.name}: thanks for choosing us! If you have a minute, we'd appreciate a review: ${business.links.googleReviews} Reply STOP to opt out.`,
      };
    }
    case "owner_booking_confirmed":
    case "owner_booking_cancelled":
    case "owner_booking_rescheduled": {
      if (!b) throw new Error("booking required");
      const verb =
        template === "owner_booking_confirmed" ? "New booking" : template === "owner_booking_cancelled" ? "Cancelled" : "Rescheduled";
      return {
        subject: `${verb}: ${b.number} — ${when(b)}`,
        preview: `${verb} ${b.number}`,
        heading: `${verb}: ${b.number}`,
        paragraphs: [c ? `${c.name} · ${c.email ?? ""} · ${c.phoneE164 ? formatPhoneForDisplay(c.phoneE164) : ""}` : ""],
        details: bookingDetails(b, services),
        cta: { label: "Open in admin", href: `${input.siteUrl}/admin/bookings/${b.id}` },
        sms: `${verb}: ${b.number} ${when(b)} — ${vehicle(b)}, ${b.locationType === "mobile" ? formatAddress(b.address) : "shop"}`,
      };
    }
    case "owner_alert": {
      const subject = String(input.data?.subject ?? "Attention needed");
      const body = String(input.data?.body ?? "");
      return {
        subject,
        preview: subject,
        heading: subject,
        paragraphs: [body],
        details: b ? [{ label: "Booking", value: b.number }] : [],
        cta: b ? { label: "Open in admin", href: `${input.siteUrl}/admin/bookings/${b.id}` } : { label: "Open admin", href: `${input.siteUrl}/admin` },
        sms: `${business.name} alert: ${subject}`,
      };
    }
    case "quote_received": {
      if (!q) throw new Error("quote required");
      return {
        subject: `We got your request (${q.number})`,
        preview: "We'll get back to you with a price soon.",
        heading: `Thanks, ${first} — we're on it`,
        paragraphs: [
          "We've received your custom job request and photos. We'll review everything and send you a price, usually within one business day.",
          "Once you accept the quote, you'll be able to pick a time and book online.",
        ],
        details: [{ label: "Reference", value: q.number }],
        sms: `${business.name}: we got your quote request ${q.number} and will reply soon.`,
      };
    }
    case "quote_sent": {
      if (!q) throw new Error("quote required");
      return {
        subject: `Your quote from ${business.name}: ${money(q.quotedPriceCents ?? 0)}`,
        preview: "Review your quote and book a time.",
        heading: "Your quote is ready",
        paragraphs: [q.quoteMessage ?? "Here's our price for the job you described.", "Accept it to choose a time that suits you."],
        details: [
          { label: "Reference", value: q.number },
          { label: "Price", value: money(q.quotedPriceCents ?? 0) },
          { label: "Estimated time", value: formatDuration(q.quotedDurationMin ?? 60) },
          ...(q.quoteExpiresAt ? [{ label: "Valid until", value: q.quoteExpiresAt.toISOString().slice(0, 10) }] : []),
        ],
        cta: input.quoteUrl ? { label: "View quote & book", href: input.quoteUrl } : undefined,
        sms: `${business.name}: your quote ${q.number} is ${money(q.quotedPriceCents ?? 0)}. View & book: ${input.quoteUrl ?? ""} Reply STOP to opt out.`,
      };
    }
    case "owner_new_quote": {
      if (!q) throw new Error("quote required");
      return {
        subject: `New quote request ${q.number}${q.outOfArea ? " (outside area)" : ""}`,
        preview: q.description.slice(0, 90),
        heading: `New quote request ${q.number}`,
        paragraphs: [q.description],
        details: [
          { label: "Customer", value: c ? `${c.name} · ${c.email ?? ""} · ${c.phoneE164 ?? ""}` : "" },
          { label: "Location", value: q.locationType === "shop" ? "Shop" : formatAddress(q.address) },
          ...(q.outOfArea ? [{ label: "Note", value: "Outside the regular service area" }] : []),
        ],
        cta: { label: "Price this job", href: `${input.siteUrl}/admin/quotes/${q.id}` },
        sms: `New quote request ${q.number} from ${c?.name ?? "a customer"}. ${input.siteUrl}/admin/quotes/${q.id}`,
      };
    }
    case "owner_new_lead": {
      if (!lead) throw new Error("lead required");
      return {
        subject: `New ${lead.source.replace("_", " ")} lead: ${lead.name ?? lead.email ?? "unknown"}`,
        preview: (lead.message ?? "").slice(0, 90),
        heading: "New lead",
        paragraphs: [lead.message ?? ""],
        details: [
          { label: "Name", value: lead.name ?? "" },
          { label: "Email", value: lead.email ?? "" },
          { label: "Phone", value: lead.phoneE164 ? formatPhoneForDisplay(lead.phoneE164) : "" },
        ],
        cta: { label: "Open leads", href: `${input.siteUrl}/admin/leads` },
        sms: `New lead: ${lead.name ?? ""} ${lead.phoneE164 ?? lead.email ?? ""} — ${(lead.message ?? "").slice(0, 80)}`,
      };
    }
    case "contact_received": {
      return {
        subject: `Thanks for getting in touch with ${business.name}`,
        preview: "We'll reply shortly.",
        heading: `Thanks, ${lead?.name?.split(" ")[0] ?? "there"}`,
        paragraphs: ["We've got your message and will reply within one business day.", `Need us sooner? Call ${business.contact.phoneDisplay}.`],
        details: [],
        cta: { label: "Book online", href: `${input.siteUrl}/book` },
        sms: "",
      };
    }
  }
}

export const SIGNATURE = sig;
