/**
 * Booking and quote state machines (docs/PLAN.md §4.2–4.3).
 * `lib/server/booking/transition.ts` is the only writer of booking.status and it
 * enforces these tables with a conditional UPDATE … WHERE status = ANY(from).
 */

export const BOOKING_STATUSES = [
  "held",
  "pending_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "expired",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_TRANSITIONS = {
  attach_contact: { from: ["held"], to: "held" },
  start_payment: { from: ["held", "pending_payment"], to: "pending_payment" },
  confirm_no_deposit: { from: ["held"], to: "confirmed" },
  payment_succeeded: { from: ["pending_payment"], to: "confirmed" },
  late_payment_reacquired: { from: ["expired"], to: "confirmed" },
  expire: { from: ["held", "pending_payment"], to: "expired" },
  reschedule: { from: ["confirmed"], to: "confirmed" },
  cancel: { from: ["confirmed"], to: "cancelled" },
  start: { from: ["confirmed"], to: "in_progress" },
  complete: { from: ["confirmed", "in_progress"], to: "completed" },
  no_show: { from: ["confirmed", "in_progress"], to: "no_show" },
} as const satisfies Record<string, { from: readonly BookingStatus[]; to: BookingStatus }>;

export type BookingEvent = keyof typeof BOOKING_TRANSITIONS;

export function canTransition(status: BookingStatus, event: BookingEvent): boolean {
  return (BOOKING_TRANSITIONS[event].from as readonly BookingStatus[]).includes(status);
}

export const TERMINAL_STATUSES: readonly BookingStatus[] = ["completed", "cancelled", "no_show", "expired"];

/** Statuses whose allocation occupies resource time. */
export const ACTIVE_STATUSES: readonly BookingStatus[] = [
  "held",
  "pending_payment",
  "confirmed",
  "in_progress",
];

export const QUOTE_STATUSES = ["new", "quoted", "accepted", "declined", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_TRANSITIONS = {
  send_quote: { from: ["new", "quoted"], to: "quoted" },
  accept: { from: ["quoted"], to: "accepted" },
  decline: { from: ["new", "quoted"], to: "declined" },
  expire: { from: ["quoted"], to: "expired" },
} as const satisfies Record<string, { from: readonly QuoteStatus[]; to: QuoteStatus }>;

export type QuoteEvent = keyof typeof QUOTE_TRANSITIONS;

export function canTransitionQuote(status: QuoteStatus, event: QuoteEvent): boolean {
  return (QUOTE_TRANSITIONS[event].from as readonly QuoteStatus[]).includes(status);
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  held: "Held",
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Expired",
};
