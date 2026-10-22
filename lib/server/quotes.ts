/**
 * Custom jobs / quote requests (docs/PLAN.md §4 step 3B, §4.3).
 * new → quoted (owner prices it, customer gets a signed link) → accepted (booked) / declined / expired.
 */
import { and, count, eq, inArray } from "drizzle-orm";
import { business } from "@/config/business";
import { getDb, type Db } from "@/db/client";
import * as s from "@/db/schema";
import { canTransitionQuote } from "@/lib/domain/booking-state";
import { quoteNumber } from "@/lib/domain/ids";
import { MINUTE } from "@/lib/domain/time";
import { env } from "@/lib/env";
import type { Attribution, ContactData, CustomJobInput, LocationInput } from "@/lib/validation/booking";
import { upsertCustomer } from "./booking/checkout";
import { loadBookingContext } from "./booking/context";
import { resolveLocation } from "./booking/location";
import { loadQuoteByToken } from "./booking/quotes-lookup";
import { recordFunnel } from "./funnel";
import { canTextCustomer, enqueueQuoteReceived, enqueueQuoteSent } from "./notify/enqueue";
import { presignUpload, UPLOAD_LIMITS, verifyUpload, type UploadType } from "./storage";
import { deriveToken, hashToken, newId } from "./tokens";

export interface QuoteSubmission {
  submissionId: string;
  sessionId: string;
  uploadSessionId: string;
  vehicle: { sizeId?: string | null; year?: string; make?: string; model?: string; color?: string };
  job: Required<Pick<CustomJobInput, "description" | "photoIds" | "preferredDates" | "serviceIds">> & { budgetRange?: string };
  location: LocationInput;
  contact: ContactData;
  attribution: Attribution;
}

export async function submitQuoteRequest(input: QuoteSubmission, meta: { ip: string | null; now: Date }, db: Db = getDb()) {
  const ctx = await loadBookingContext(db);
  const loc = resolveLocation(ctx, input.location);
  if (!loc.ok && loc.code === "LOCATION_TYPE_UNAVAILABLE") return { ok: false as const, message: loc.message };
  const outOfArea = !loc.ok;
  const address =
    input.location.locationType === "mobile"
      ? {
          ...input.location.address,
          line2: input.location.address.line2 || undefined,
          country: "US",
        }
      : null;

  const [existing] = await db.select().from(s.quoteRequests).where(eq(s.quoteRequests.submissionId, input.submissionId));
  if (existing) return { ok: true as const, number: existing.number };

  const quote = await db.transaction(async (tx) => {
    const customer = await upsertCustomer(tx, input.contact, meta);
    const sizeId = input.vehicle.sizeId && ctx.catalog.sizes.some((z) => z.id === input.vehicle.sizeId) ? input.vehicle.sizeId : null;
    const [q] = await tx
      .insert(s.quoteRequests)
      .values({
        number: quoteNumber(business.bookingPrefix),
        submissionId: input.submissionId,
        customerId: customer.id,
        vehicleSizeId: sizeId,
        vehicleYear: input.vehicle.year ? Number(input.vehicle.year) : null,
        vehicleMake: input.vehicle.make || null,
        vehicleModel: input.vehicle.model || null,
        vehicleColor: input.vehicle.color || null,
        description: input.job.description,
        serviceIds: input.job.serviceIds.filter((id) => ctx.catalog.services.some((x) => x.id === id)),
        preferredDates: input.job.preferredDates,
        budgetRange: input.job.budgetRange ?? null,
        locationType: input.location.locationType,
        address: loc.ok ? loc.address : address,
        zoneId: loc.ok ? (loc.zone?.id ?? null) : null,
        outOfArea,
        attribution: input.attribution,
        createdAt: meta.now,
        updatedAt: meta.now,
      })
      .returning();
    if (!q) throw new Error("quote insert failed");

    if (input.job.photoIds.length) {
      await tx
        .update(s.quotePhotos)
        .set({ quoteRequestId: q.id, status: "attached" })
        .where(
          and(
            eq(s.quotePhotos.uploadSessionId, input.uploadSessionId),
            eq(s.quotePhotos.status, "uploaded"),
            inArray(s.quotePhotos.id, input.job.photoIds),
          ),
        );
    }
    const [lead] = await tx
      .insert(s.leads)
      .values({
        submissionId: input.submissionId,
        source: "quote",
        name: customer.name,
        email: customer.email,
        phoneE164: customer.phoneE164,
        message: input.job.description,
        customerId: customer.id,
        quoteRequestId: q.id,
        consentContactAt: meta.now,
        attribution: input.attribution,
        createdAt: meta.now,
        updatedAt: meta.now,
      })
      .onConflictDoNothing()
      .returning();
    void lead;
    await enqueueQuoteReceived(tx, q, meta.now);
    return q;
  });
  await recordFunnel(db, { sessionId: input.sessionId, event: "quote_submitted", step: "custom", at: meta.now, utmSource: input.attribution.utmSource });
  return { ok: true as const, number: quote.number, quoteRequestId: quote.id, outOfArea };
}

export function quoteTokenFor(quoteId: string, version: number) {
  return deriveToken(env().TOKEN_PEPPER, "quote", quoteId, version);
}

export async function sendQuote(
  quoteId: string,
  args: { priceCents: number; durationMin: number; depositCents: number | null; message: string; validDays: number; adminId: string },
  now: Date,
  db: Db = getDb(),
) {
  return db.transaction(async (tx) => {
    const [q] = await tx.select().from(s.quoteRequests).where(eq(s.quoteRequests.id, quoteId)).for("update");
    if (!q) return { ok: false as const, message: "Quote not found." };
    if (!canTransitionQuote(q.status, "send_quote")) return { ok: false as const, message: `Can't send a quote that is ${q.status}.` };
    const version = q.quoteTokenVersion + 1;
    const token = quoteTokenFor(q.id, version);
    const [updated] = await tx
      .update(s.quoteRequests)
      .set({
        status: "quoted",
        quotedPriceCents: args.priceCents,
        quotedDurationMin: args.durationMin,
        quotedDepositCents: args.depositCents,
        quoteMessage: args.message || null,
        quoteTokenHash: hashToken(token),
        quoteTokenVersion: version,
        quoteExpiresAt: new Date(now.getTime() + args.validDays * 24 * 60 * MINUTE),
        quotedAt: now,
        quotedBy: args.adminId,
        updatedAt: now,
      })
      .where(eq(s.quoteRequests.id, q.id))
      .returning();
    const [customer] = await tx.select().from(s.customers).where(eq(s.customers.id, q.customerId));
    await enqueueQuoteSent(tx, updated!, canTextCustomer(customer), now);
    return { ok: true as const, token };
  });
}

export async function declineQuote(
  by: { token: string } | { quoteId: string; adminId: string },
  reason: string | null,
  now: Date,
  db: Db = getDb(),
) {
  const q = "token" in by ? await loadQuoteByToken(db, by.token) : (await db.select().from(s.quoteRequests).where(eq(s.quoteRequests.id, by.quoteId)))[0];
  if (!q || !canTransitionQuote(q.status, "decline")) return { ok: false as const };
  await db
    .update(s.quoteRequests)
    .set({ status: "declined", declineReason: reason, respondedAt: now, updatedAt: now })
    .where(eq(s.quoteRequests.id, q.id));
  return { ok: true as const };
}

// ── Photo uploads ─────────────────────────────────────────────────────────────

const EXT: Record<UploadType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function signPhotoUpload(
  input: { uploadSessionId: string; contentType: string; size: number },
  nowMs: number,
  db: Db = getDb(),
) {
  if (!(UPLOAD_LIMITS.types as readonly string[]).includes(input.contentType))
    return { ok: false as const, message: "Please upload JPG, PNG, WebP or HEIC photos." };
  if (input.size <= 0 || input.size > UPLOAD_LIMITS.maxBytes)
    return { ok: false as const, message: "Each photo must be smaller than 15 MB." };
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(s.quotePhotos)
    .where(and(eq(s.quotePhotos.uploadSessionId, input.uploadSessionId), inArray(s.quotePhotos.status, ["pending", "uploaded"])));
  if (n >= UPLOAD_LIMITS.maxFiles) return { ok: false as const, message: "You can upload up to 10 photos." };
  const id = newId();
  const type = input.contentType as UploadType;
  const key = `quotes/pending/${input.uploadSessionId}/${id}.${EXT[type]}`;
  await db.insert(s.quotePhotos).values({
    id,
    uploadSessionId: input.uploadSessionId,
    storageKey: key,
    contentType: type,
    sizeBytes: input.size,
    status: "pending",
  });
  const signed = await presignUpload(key, type, input.size, nowMs);
  return { ok: true as const, photoId: id, ...signed };
}

export async function confirmPhotoUpload(photoId: string, uploadSessionId: string, db: Db = getDb()) {
  const [photo] = await db
    .select()
    .from(s.quotePhotos)
    .where(and(eq(s.quotePhotos.id, photoId), eq(s.quotePhotos.uploadSessionId, uploadSessionId)));
  if (!photo) return { ok: false as const };
  if (photo.status === "uploaded" || photo.status === "attached") return { ok: true as const };
  const valid = await verifyUpload(photo.storageKey, photo.contentType, photo.sizeBytes);
  await db
    .update(s.quotePhotos)
    .set({ status: valid ? "uploaded" : "rejected" })
    .where(eq(s.quotePhotos.id, photoId));
  return { ok: valid };
}
