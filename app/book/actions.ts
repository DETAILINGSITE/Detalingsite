"use server";
/**
 * Booking-flow Server Actions. Each one: validate raw input (Zod) → rate-limit →
 * call the service → flush side effects after the response.
 */
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { priceSummary } from "@/lib/booking/summary";
import { verifyCaptcha } from "@/lib/server/captcha";
import { now } from "@/lib/server/clock";
import { attachContact, startPayment } from "@/lib/server/booking/checkout";
import { loadBookingContext } from "@/lib/server/booking/context";
import { createHold, extendHold, loadLiveHold, releaseHold } from "@/lib/server/booking/holds";
import { checkPromo, pricingContext, quoteTermsFrom } from "@/lib/server/booking/pricing";
import { flushOutbox } from "@/lib/server/jobs";
import { confirmPhotoUpload, signPhotoUpload, submitQuoteRequest } from "@/lib/server/quotes";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { price } from "@/lib/domain/pricing";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ConfirmUploadSchema,
  ContactActionSchema,
  HoldRequestSchema,
  PromoPreviewSchema,
  QuoteSubmissionSchema,
  SignUploadSchema,
  StartPaymentSchema,
  TokenSchema,
} from "@/lib/validation/actions";

type Fail = { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

function invalid(error: z.ZodError): Fail {
  const flat = z.flattenError(error);
  return {
    ok: false,
    code: "VALIDATION",
    message: "Please check the highlighted fields.",
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
  };
}

async function limited(name: Parameters<typeof rateLimit>[1]): Promise<Fail | null> {
  const ip = await clientIp();
  const r = await rateLimit(getDb(), name, ip, now());
  if (r.ok) return null;
  return {
    ok: false,
    code: "RATE_LIMITED",
    message: `Too many attempts — please try again in ${Math.ceil(r.retryAfterSec / 60)} minute(s), or give us a call.`,
  };
}

function flushLater() {
  after(async () => {
    try {
      await flushOutbox();
    } catch (err) {
      console.error("[after] outbox flush failed", err);
    }
  });
}

export async function createHoldAction(raw: unknown) {
  const parsed = HoldRequestSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const rl = await limited("hold");
  if (rl) return rl;
  const result = await createHold(parsed.data, new Date(now()));
  flushLater();
  return result;
}

export async function extendHoldAction(raw: unknown) {
  const parsed = TokenSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  return extendHold(parsed.data.token, new Date(now()));
}

export async function releaseHoldAction(raw: unknown) {
  const parsed = TokenSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const r = await releaseHold(parsed.data.token, new Date(now()));
  flushLater();
  return r;
}

export async function getDraftAction(raw: unknown) {
  const parsed = TokenSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const at = new Date(now());
  const live = await loadLiveHold(db, parsed.data.token, at);
  if (!live.ok) {
    return {
      ok: false as const,
      code: live.code,
      status: "booking" in live ? (live.booking?.status ?? null) : null,
      message: live.code === "HOLD_EXPIRED" ? "Your hold expired." : "Booking not found.",
    };
  }
  const b = live.booking;
  let customer = null;
  if (b.customerId) {
    const [c] = await db.select().from(s.customers).where(eq(s.customers.id, b.customerId));
    customer = c ? { name: c.name, email: c.email ?? "", phone: c.phoneE164 ?? "" } : null;
  }
  return {
    ok: true as const,
    status: b.status,
    number: b.number,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    holdExpiresAt: live.alloc.holdExpiresAt?.toISOString() ?? null,
    holdExtensions: b.holdExtensions,
    price: priceSummary(b.priceSnapshot),
    hasContact: Boolean(b.customerId),
    customer,
  };
}

export async function attachContactAction(raw: unknown) {
  const parsed = ContactActionSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const rl = await limited("contactStep");
  if (rl) return rl;
  if (parsed.data.contact.website) return { ok: false as const, code: "VALIDATION", message: "Please try again." };
  const ip = await clientIp();
  const captcha = await verifyCaptcha(parsed.data.captchaToken, { ip, action: "booking_contact" });
  if (!captcha.ok)
    return { ok: false as const, code: "CAPTCHA_FAILED", message: "Please complete the security check and try again." };
  return attachContact(parsed.data.token, parsed.data.contact, { ip, now: new Date(now()), sessionId: parsed.data.sessionId });
}

export async function previewPromoAction(raw: unknown) {
  const parsed = PromoPreviewSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const at = new Date(now());
  const live = await loadLiveHold(db, parsed.data.token, at);
  if (!live.ok) return { ok: false as const, code: live.code, message: "Your hold expired." };
  const check = await checkPromo(db, parsed.data.promoCode, at, live.booking.customerId);
  if (!check.ok) return { ok: false as const, code: "PROMO_INVALID", message: check.message };
  const ctx = await loadBookingContext(db);
  let quote = null;
  if (live.booking.quoteRequestId) {
    const [q] = await db.select().from(s.quoteRequests).where(eq(s.quoteRequests.id, live.booking.quoteRequestId));
    if (q) quote = quoteTermsFrom(q);
  }
  const zone = ctx.schedule.zones.find((z) => z.id === live.booking.zoneId) ?? null;
  const result = price(
    { ...live.booking.selection, locationType: live.booking.locationType },
    pricingContext(ctx, { zone, promo: check.promo, quote }),
  );
  return { ok: true as const, price: priceSummary({ ...result, sizeLabel: live.booking.priceSnapshot.sizeLabel, computedAt: at.toISOString() }) };
}

export async function startPaymentAction(raw: unknown) {
  const parsed = StartPaymentSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const rl = await limited("payment");
  if (rl) return rl;
  const result = await startPayment(
    parsed.data.token,
    { promoCode: parsed.data.promoCode, expectedTotalCents: parsed.data.expectedTotalCents, sessionId: parsed.data.sessionId },
    new Date(now()),
  );
  flushLater();
  return result;
}

export async function submitQuoteAction(raw: unknown) {
  const parsed = QuoteSubmissionSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const rl = await limited("form");
  if (rl) return rl;
  if (parsed.data.contact.website) return { ok: false as const, code: "VALIDATION", message: "Please try again." };
  const ip = await clientIp();
  const captcha = await verifyCaptcha(parsed.data.captchaToken, { ip, action: "quote_request" });
  if (!captcha.ok)
    return { ok: false as const, code: "CAPTCHA_FAILED", message: "Please complete the security check and try again." };
  const { captchaToken: _c, ...input } = parsed.data;
  const result = await submitQuoteRequest(
    {
      ...input,
      job: {
        description: input.job.description,
        photoIds: input.job.photoIds,
        preferredDates: input.job.preferredDates,
        serviceIds: input.job.serviceIds,
        budgetRange: input.job.budgetRange,
      },
    },
    { ip, now: new Date(now()) },
  );
  flushLater();
  return result;
}

export async function signUploadAction(raw: unknown) {
  const parsed = SignUploadSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const rl = await limited("uploadSign");
  if (rl) return rl;
  try {
    return await signPhotoUpload(parsed.data, now());
  } catch {
    return { ok: false as const, message: "Photo uploads are unavailable right now — describe the job instead." };
  }
}

export async function confirmUploadAction(raw: unknown) {
  const parsed = ConfirmUploadSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  return confirmPhotoUpload(parsed.data.photoId, parsed.data.uploadSessionId);
}
