"use server";
/**
 * Admin mutations. Each: requireAdmin (server-side, never trusting the proxy) →
 * Zod-validate FormData → mutate → audit log → revalidate public caches.
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { EXCLUSION_VIOLATION, getDb, pgErrorCode } from "@/db/client";
import * as s from "@/db/schema";
import { OperationalSettingsSchema } from "@/lib/domain/settings";
import { audit, requireAdmin } from "@/lib/server/admin-guard";
import { now } from "@/lib/server/clock";
import { adminSetStatus, cancelBooking, recordBalancePayment, rescheduleBooking } from "@/lib/server/booking/manage";
import { CACHE_TAGS } from "@/lib/server/data/public";
import { flushOutbox } from "@/lib/server/jobs";
import { declineQuote, sendQuote } from "@/lib/server/quotes";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const fd = (f: FormData) => Object.fromEntries(f.entries());
const dollars = z.coerce.number().min(0).max(100_000).transform((v) => Math.round(v * 100));
const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const lines = (v: unknown) => String(v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

function bust(...tags: (keyof typeof CACHE_TAGS)[]) {
  for (const t of tags) revalidateTag(CACHE_TAGS[t], "max");
}
function flush() {
  after(() => flushOutbox().catch((e) => console.error(e)));
}
function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) return { ok: false, message: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  if (e instanceof Error) return { ok: false, message: e.message };
  return { ok: false, message: "Something went wrong." };
}

async function getBooking(id: string) {
  const [b] = await getDb().select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!b) throw new Error("Booking not found");
  return b;
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export async function bookingStatusAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const { id, event } = z.object({ id: z.uuid(), event: z.enum(["start", "complete", "no_show"]) }).parse(fd(form));
    const res = await adminSetStatus(await getBooking(id), event, admin.userId, new Date(now()));
    await audit(admin, `booking.${event}`, "booking", id);
    revalidatePath(`/admin/bookings/${id}`);
    flush();
    return res.ok ? { ok: true } : res;
  } catch (e) {
    return fail(e);
  }
}

export async function bookingCancelAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin("owner");
    const p = z.object({ id: z.uuid(), waiveFee: bool, reason: z.string().max(500).optional() }).parse(fd(form));
    const res = await cancelBooking(await getBooking(p.id), { actor: "admin", actorId: admin.userId, reason: p.reason, waiveFee: p.waiveFee }, new Date(now()));
    await audit(admin, "booking.cancel", "booking", p.id, { waiveFee: p.waiveFee });
    revalidatePath(`/admin/bookings/${p.id}`);
    flush();
    return res.ok ? { ok: true, message: "Cancelled." } : res;
  } catch (e) {
    return fail(e);
  }
}

export async function bookingRescheduleAction(input: { id: string; startIso: string; resourceId?: string }): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ id: z.uuid(), startIso: z.iso.datetime({ offset: true }), resourceId: z.uuid().optional() }).parse(input);
    const res = await rescheduleBooking(await getBooking(p.id), p.startIso, { kind: "admin", id: admin.userId }, new Date(now()), getDb(), { resourceId: p.resourceId });
    await audit(admin, "booking.reschedule", "booking", p.id, { to: p.startIso, resourceId: p.resourceId });
    revalidatePath("/admin/calendar");
    revalidatePath(`/admin/bookings/${p.id}`);
    flush();
    if (res.ok) return { ok: true };
    return { ok: false, message: "reason" in res ? res.reason : "That time conflicts with another booking or block." };
  } catch (e) {
    return fail(e);
  }
}

export async function bookingBalanceAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ id: z.uuid(), amount: dollars, method: z.enum(["cash", "card_terminal", "other"]), note: z.string().max(300).optional() }).parse(fd(form));
    await recordBalancePayment(await getBooking(p.id), { amountCents: p.amount, method: p.method, note: p.note, adminId: admin.userId }, new Date(now()));
    await audit(admin, "booking.balance", "booking", p.id, { amount: p.amount, method: p.method });
    revalidatePath(`/admin/bookings/${p.id}`);
    return { ok: true, message: "Payment recorded." };
  } catch (e) {
    return fail(e);
  }
}

export async function bookingNotesAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ id: z.uuid(), notes: z.string().max(5000) }).parse(fd(form));
    await getDb().update(s.bookings).set({ internalNotes: p.notes, updatedAt: new Date(now()) }).where(eq(s.bookings.id, p.id));
    await audit(admin, "booking.notes", "booking", p.id);
    revalidatePath(`/admin/bookings/${p.id}`);
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

// ── Quotes & leads ───────────────────────────────────────────────────────────

export async function sendQuoteAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z
      .object({
        id: z.uuid(),
        price: dollars,
        hours: z.coerce.number().min(0.25).max(80),
        deposit: z.union([z.literal(""), dollars]).optional(),
        message: z.string().max(2000).default(""),
        validDays: z.coerce.number().int().min(1).max(90).default(14),
      })
      .parse(fd(form));
    const res = await sendQuote(
      p.id,
      { priceCents: p.price, durationMin: Math.round(p.hours * 60), depositCents: typeof p.deposit === "number" ? p.deposit : null, message: p.message, validDays: p.validDays, adminId: admin.userId },
      new Date(now()),
    );
    await audit(admin, "quote.send", "quote", p.id, { price: p.price });
    revalidatePath(`/admin/quotes/${p.id}`);
    flush();
    return res.ok ? { ok: true, message: "Quote sent to the customer." } : res;
  } catch (e) {
    return fail(e);
  }
}

export async function declineQuoteAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ id: z.uuid(), reason: z.string().max(500).optional() }).parse(fd(form));
    await declineQuote({ quoteId: p.id, adminId: admin.userId }, p.reason ?? null, new Date(now()));
    await audit(admin, "quote.decline", "quote", p.id);
    revalidatePath(`/admin/quotes/${p.id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function leadUpdateAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ id: z.uuid(), status: z.enum(["new", "contacted", "won", "lost", "spam"]), notes: z.string().max(5000).default("") }).parse(fd(form));
    await getDb().update(s.leads).set({ status: p.status, notes: p.notes, updatedAt: new Date(now()) }).where(eq(s.leads.id, p.id));
    await audit(admin, "lead.update", "lead", p.id, { status: p.status });
    revalidatePath("/admin/leads");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function anonymizeCustomerAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin("owner");
    const { id } = z.object({ id: z.uuid() }).parse(fd(form));
    const at = new Date(now());
    await getDb()
      .update(s.customers)
      .set({ name: "Anonymized customer", email: null, phoneE164: null, smsConsentIp: null, notes: "", anonymizedAt: at, updatedAt: at })
      .where(eq(s.customers.id, id));
    await getDb().update(s.leads).set({ name: null, email: null, phoneE164: null, message: null }).where(eq(s.leads.customerId, id));
    await audit(admin, "customer.anonymize", "customer", id);
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, message: "Customer data anonymized." };
  } catch (e) {
    return fail(e);
  }
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export async function serviceSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = fd(form);
    const p = z
      .object({
        id: z.uuid().optional().or(z.literal("")),
        slug: z.string().regex(/^[a-z0-9-]{2,60}$/, "Use lowercase letters, numbers and dashes"),
        name: z.string().min(2).max(80),
        kind: z.enum(["service", "addon"]),
        categoryId: z.uuid().optional().or(z.literal("")),
        summary: z.string().max(300).default(""),
        descriptionMd: z.string().max(5000).default(""),
        basePrice: dollars,
        baseDurationMin: z.coerce.number().int().min(5).max(2880),
        quoteOnly: bool,
        active: bool,
        mobile: bool,
        shop: bool,
        sort: z.coerce.number().int().default(0),
      })
      .parse(raw);
    const values = {
      slug: p.slug,
      name: p.name,
      kind: p.kind,
      categoryId: p.categoryId || null,
      summary: p.summary,
      descriptionMd: p.descriptionMd,
      includes: lines(raw.includes),
      whatToExpect: lines(raw.whatToExpect),
      basePriceCents: p.basePrice,
      baseDurationMin: p.baseDurationMin,
      quoteOnly: p.quoteOnly,
      active: p.active,
      locationTypes: [...(p.mobile ? (["mobile"] as const) : []), ...(p.shop ? (["shop"] as const) : [])],
      sort: p.sort,
      isPlaceholder: false,
      updatedAt: new Date(now()),
    };
    if (values.locationTypes.length === 0) return { ok: false, message: "Choose mobile, shop or both." };
    const db = getDb();
    let id = p.id || null;
    if (id) await db.update(s.services).set(values).where(eq(s.services.id, id));
    else id = (await db.insert(s.services).values(values).returning({ id: s.services.id }))[0]!.id;
    // Per-size overrides: fields price_<size> / dur_<size> (blank = use multiplier).
    const sizes = await db.select().from(s.vehicleSizes);
    for (const z0 of sizes) {
      const pr = String(raw[`price_${z0.id}`] ?? "").trim();
      const du = String(raw[`dur_${z0.id}`] ?? "").trim();
      await db.delete(s.serviceSizePrices).where(and(eq(s.serviceSizePrices.serviceId, id), eq(s.serviceSizePrices.sizeId, z0.id)));
      if (pr || du) {
        await db.insert(s.serviceSizePrices).values({ serviceId: id, sizeId: z0.id, priceCents: pr ? Math.round(Number(pr) * 100) : null, durationMin: du ? Number(du) : null });
      }
    }
    await audit(admin, p.id ? "service.update" : "service.create", "service", id, { price: p.basePrice });
    bust("catalog");
    revalidatePath("/admin/catalog");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function packageSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = fd(form);
    const p = z
      .object({
        id: z.uuid().optional().or(z.literal("")),
        slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
        name: z.string().min(2).max(60),
        tagline: z.string().max(200).default(""),
        basePrice: dollars,
        baseDurationMin: z.coerce.number().int().min(5).max(2880),
        tier: z.coerce.number().int().min(1).max(9).default(1),
        featured: bool,
        active: bool,
        sort: z.coerce.number().int().default(0),
      })
      .parse(raw);
    const serviceIds = form.getAll("serviceIds").map(String).filter((x) => z.uuid().safeParse(x).success);
    const db = getDb();
    const values = { slug: p.slug, name: p.name, tagline: p.tagline, basePriceCents: p.basePrice, baseDurationMin: p.baseDurationMin, tier: p.tier, featured: p.featured, active: p.active, sort: p.sort, isPlaceholder: false, updatedAt: new Date(now()) };
    let id = p.id || null;
    if (id) await db.update(s.packages).set(values).where(eq(s.packages.id, id));
    else id = (await db.insert(s.packages).values(values).returning({ id: s.packages.id }))[0]!.id;
    await db.delete(s.packageItems).where(eq(s.packageItems.packageId, id));
    if (serviceIds.length) await db.insert(s.packageItems).values(serviceIds.map((serviceId) => ({ packageId: id!, serviceId })));
    const sizes = await db.select().from(s.vehicleSizes);
    for (const z0 of sizes) {
      const pr = String(raw[`price_${z0.id}`] ?? "").trim();
      const du = String(raw[`dur_${z0.id}`] ?? "").trim();
      await db.delete(s.packageSizePrices).where(and(eq(s.packageSizePrices.packageId, id), eq(s.packageSizePrices.sizeId, z0.id)));
      if (pr || du) await db.insert(s.packageSizePrices).values({ packageId: id, sizeId: z0.id, priceCents: pr ? Math.round(Number(pr) * 100) : null, durationMin: du ? Number(du) : null });
    }
    await audit(admin, p.id ? "package.update" : "package.create", "package", id);
    bust("catalog");
    revalidatePath("/admin/catalog");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function sizeSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z
      .object({ id: z.string().regex(/^[a-z0-9_-]{2,20}$/), label: z.string().min(2).max(40), priceMultiplier: z.coerce.number().min(0.5).max(5), durationMultiplier: z.coerce.number().min(0.5).max(5), sort: z.coerce.number().int().default(0), active: bool })
      .parse(fd(form));
    await getDb().insert(s.vehicleSizes).values(p).onConflictDoUpdate({ target: s.vehicleSizes.id, set: { ...p, updatedAt: new Date(now()) } });
    await audit(admin, "size.save", "vehicle_size", p.id, p);
    bust("catalog");
    revalidatePath("/admin/catalog");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function ruleAddAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ kind: z.enum(["requires", "excludes"]), serviceId: z.uuid(), targetServiceId: z.uuid(), reason: z.string().min(5).max(300) }).parse(fd(form));
    if (p.serviceId === p.targetServiceId) return { ok: false, message: "Pick two different services." };
    await getDb().insert(s.serviceRules).values(p).onConflictDoNothing();
    await audit(admin, "rule.add", "service_rule", null, p);
    bust("catalog");
    revalidatePath("/admin/catalog");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function ruleDeleteAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(fd(form));
    await getDb().delete(s.serviceRules).where(eq(s.serviceRules.id, id));
    await audit(admin, "rule.delete", "service_rule", id);
    bust("catalog");
    revalidatePath("/admin/catalog");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function conditionSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z
      .object({ id: z.string().regex(/^[a-z0-9_]{2,30}$/), group: z.enum(["soil", "extra"]), label: z.string().min(2).max(60), description: z.string().max(200).default(""), surchargeType: z.enum(["flat", "percent"]), surchargeValue: z.coerce.number().min(0), extraMinutes: z.coerce.number().int().min(0).max(600), sort: z.coerce.number().int().default(0), active: bool })
      .parse(fd(form));
    const value = p.surchargeType === "flat" ? Math.round(p.surchargeValue * 100) : Math.round(p.surchargeValue);
    const row = { ...p, surchargeValue: value };
    await getDb().insert(s.conditions).values(row).onConflictDoUpdate({ target: s.conditions.id, set: row });
    await audit(admin, "condition.save", "condition", p.id);
    bust("catalog");
    revalidatePath("/admin/catalog");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

// ── Schedule & area ──────────────────────────────────────────────────────────

export async function hoursSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const rows: { weekday: number; opens: string; closes: string }[] = [];
    for (let d = 1; d <= 7; d++) {
      if (form.get(`open_${d}`) !== "on") continue;
      const opens = String(form.get(`opens_${d}`) ?? "");
      const closes = String(form.get(`closes_${d}`) ?? "");
      if (!/^\d{2}:\d{2}$/.test(opens) || !/^\d{2}:\d{2}$/.test(closes) || opens >= closes) return { ok: false, message: `Check the hours for day ${d}: opening must be before closing.` };
      rows.push({ weekday: d, opens, closes });
    }
    await getDb().transaction(async (tx) => {
      await tx.delete(s.businessHours);
      if (rows.length) await tx.insert(s.businessHours).values(rows);
    });
    await audit(admin, "hours.save", "business_hours", null, { rows });
    bust("settings");
    revalidatePath("/admin/schedule");
    return { ok: true, message: "Hours saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function blackoutAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ op: z.enum(["add", "remove"]), date: z.iso.date(), reason: z.string().max(100).default("") }).parse(fd(form));
    if (p.op === "add") await getDb().insert(s.blackoutDates).values({ date: p.date, reason: p.reason }).onConflictDoUpdate({ target: s.blackoutDates.date, set: { reason: p.reason } });
    else await getDb().delete(s.blackoutDates).where(eq(s.blackoutDates.date, p.date));
    await audit(admin, `blackout.${p.op}`, "blackout", p.date);
    bust("settings");
    revalidatePath("/admin/schedule");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resourceSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ id: z.uuid().optional().or(z.literal("")), name: z.string().min(2).max(40), type: z.enum(["mobile_crew", "shop_bay"]), active: bool, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#c8a24a") }).parse(fd(form));
    const db = getDb();
    if (p.id) await db.update(s.resources).set({ name: p.name, type: p.type, active: p.active, color: p.color, updatedAt: new Date(now()) }).where(eq(s.resources.id, p.id));
    else await db.insert(s.resources).values({ name: p.name, type: p.type, active: p.active, color: p.color });
    await audit(admin, "resource.save", "resource", p.id || null, p);
    bust("settings");
    revalidatePath("/admin/schedule");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

/** Time blocks (crew off, equipment down, multi-day jobs) share the double-booking constraint. */
export async function timeBlockAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = fd(form);
    if (raw.op === "remove") {
      const { id } = z.object({ id: z.uuid() }).parse(raw);
      await getDb().update(s.resourceAllocations).set({ active: false, updatedAt: new Date(now()) }).where(and(eq(s.resourceAllocations.id, id), eq(s.resourceAllocations.kind, "block")));
      revalidatePath("/admin/schedule");
      revalidatePath("/admin/calendar");
      return { ok: true };
    }
    const p = z.object({ resourceId: z.uuid(), start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }), note: z.string().max(200).default("") }).parse(raw);
    if (Date.parse(p.end) <= Date.parse(p.start)) return { ok: false, message: "End must be after start." };
    try {
      await getDb().insert(s.resourceAllocations).values({ resourceId: p.resourceId, kind: "block", period: { start: new Date(p.start), end: new Date(p.end) }, note: p.note, createdBy: admin.userId });
    } catch (err) {
      if (pgErrorCode(err) === EXCLUSION_VIOLATION) return { ok: false, message: "That block overlaps an existing booking or block on this crew/bay." };
      throw err;
    }
    await audit(admin, "block.add", "allocation", null, p);
    revalidatePath("/admin/schedule");
    revalidatePath("/admin/calendar");
    return { ok: true, message: "Time blocked." };
  } catch (e) {
    return fail(e);
  }
}

export async function zoneSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = fd(form);
    const p = z
      .object({ id: z.uuid().optional().or(z.literal("")), name: z.string().min(2).max(60), ringMaxKm: z.union([z.literal(""), z.coerce.number().positive().max(500)]), travelFee: dollars, travelMinutes: z.coerce.number().int().min(0).max(240), sort: z.coerce.number().int().default(0), active: bool })
      .parse(raw);
    const zipCodes = String(raw.zipCodes ?? "").split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^\d{5}$/.test(x));
    const cities = String(raw.cities ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const values = { name: p.name, zipCodes, cities, ringMaxKm: p.ringMaxKm === "" ? null : p.ringMaxKm, travelFeeCents: p.travelFee, travelMinutes: p.travelMinutes, sort: p.sort, active: p.active, updatedAt: new Date(now()) };
    const db = getDb();
    if (p.id) await db.update(s.serviceZones).set(values).where(eq(s.serviceZones.id, p.id));
    else await db.insert(s.serviceZones).values(values);
    await audit(admin, "zone.save", "zone", p.id || null, values);
    bust("settings");
    revalidatePath("/admin/area");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function cityPageSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/), city: z.string().min(2).max(60), region: z.string().min(2).max(40), zoneId: z.uuid().optional().or(z.literal("")), introMd: z.string().min(40, "Write at least a couple of sentences of genuinely local content").max(5000), localNotesMd: z.string().max(5000).default(""), published: bool }).parse(fd(form));
    const row = { ...p, zoneId: p.zoneId || null, isPlaceholder: false, updatedAt: new Date(now()) };
    await getDb().insert(s.cityPages).values(row).onConflictDoUpdate({ target: s.cityPages.slug, set: row });
    await audit(admin, "city.save", "city_page", p.slug);
    bust("content");
    revalidatePath("/admin/area");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

// ── Settings & promos ────────────────────────────────────────────────────────

export async function settingsSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin("owner");
    const raw = fd(form);
    const [current] = await getDb().select().from(s.settings).where(eq(s.settings.id, 1));
    const depositMode = String(raw.depositMode);
    const lateFeeType = String(raw.lateFeeType);
    const next = OperationalSettingsSchema.parse({
      ...(current?.data ?? {}),
      serviceMode: raw.serviceMode,
      slotIntervalMin: Number(raw.slotIntervalMin),
      bufferMin: Number(raw.bufferMin),
      minLeadHours: Number(raw.minLeadHours),
      maxDaysAhead: Number(raw.maxDaysAhead),
      holdMinutes: Number(raw.holdMinutes),
      paymentHoldMinutes: Number(raw.paymentHoldMinutes),
      travelCountsAgainstHours: raw.travelCountsAgainstHours === "on",
      deposit:
        depositMode === "none"
          ? { mode: "none" }
          : depositMode === "percent"
            ? { mode: "percent", percent: Number(raw.depositValue) }
            : { mode: "fixed", valueCents: Math.round(Number(raw.depositValue) * 100) },
      cancellation: {
        windowHours: Number(raw.windowHours),
        lateFee:
          lateFeeType === "fixed"
            ? { type: "fixed", cents: Math.round(Number(raw.lateFeeValue) * 100) }
            : lateFeeType === "percent"
              ? { type: "percent", percent: Number(raw.lateFeeValue) }
              : { type: "forfeit_deposit" },
      },
      reschedule: { minHoursBefore: Number(raw.rescheduleMinHours), maxCount: Number(raw.rescheduleMax) },
      taxRateBps: Math.round(Number(raw.taxRatePercent) * 100),
      taxTravel: raw.taxTravel === "on",
      priceRoundingCents: Number(raw.priceRoundingCents),
      catalogReviewed: raw.catalogReviewed === "on",
    });
    await getDb()
      .insert(s.settings)
      .values({ id: 1, data: next, updatedBy: admin.userId })
      .onConflictDoUpdate({ target: s.settings.id, set: { data: next, version: (current?.version ?? 1) + 1, updatedAt: new Date(now()), updatedBy: admin.userId } });
    await audit(admin, "settings.save", "settings", "1", { before: current?.data ?? null, after: next });
    bust("settings", "catalog");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function promoSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const p = z
      .object({ code: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/), kind: z.enum(["percent", "fixed"]), value: z.coerce.number().positive(), maxRedemptions: z.union([z.literal(""), z.coerce.number().int().positive()]), endsAt: z.union([z.literal(""), z.iso.date()]), firstBookingOnly: bool, active: bool })
      .parse(fd(form));
    const row = {
      code: p.code.toUpperCase(),
      kind: p.kind,
      value: p.kind === "fixed" ? Math.round(p.value * 100) : Math.min(100, Math.round(p.value)),
      maxRedemptions: p.maxRedemptions === "" ? null : p.maxRedemptions,
      endsAt: p.endsAt === "" ? null : new Date(`${p.endsAt}T23:59:59Z`),
      firstBookingOnly: p.firstBookingOnly,
      active: p.active,
      updatedAt: new Date(now()),
    };
    await getDb().insert(s.promoCodes).values(row).onConflictDoUpdate({ target: s.promoCodes.code, set: row });
    await audit(admin, "promo.save", "promo", row.code, row);
    revalidatePath("/admin/promos");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

// ── Content ──────────────────────────────────────────────────────────────────

export async function testimonialSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = fd(form);
    if (raw.op === "delete") {
      await getDb().delete(s.testimonials).where(eq(s.testimonials.id, z.uuid().parse(raw.id)));
    } else {
      const p = z.object({ id: z.uuid().optional().or(z.literal("")), authorName: z.string().min(2).max(60), vehicle: z.string().max(60).default(""), rating: z.coerce.number().int().min(1).max(5), body: z.string().min(10).max(2000), source: z.enum(["google", "yelp", "facebook", "direct"]), sourceUrl: z.union([z.literal(""), z.url()]), reviewDate: z.union([z.literal(""), z.iso.date()]), published: bool, sort: z.coerce.number().int().default(0) }).parse(raw);
      const row = { authorName: p.authorName, vehicle: p.vehicle || null, rating: p.rating, body: p.body, source: p.source, sourceUrl: p.sourceUrl || null, reviewDate: p.reviewDate || null, published: p.published, sort: p.sort, isPlaceholder: false, updatedAt: new Date(now()) };
      if (p.id) await getDb().update(s.testimonials).set(row).where(eq(s.testimonials.id, p.id));
      else await getDb().insert(s.testimonials).values(row);
    }
    await audit(admin, "testimonial.save", "testimonial", String(raw.id ?? ""));
    bust("content");
    revalidatePath("/admin/content");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function faqSaveAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = fd(form);
    if (raw.op === "delete") {
      await getDb().delete(s.faqs).where(eq(s.faqs.id, z.uuid().parse(raw.id)));
    } else {
      const p = z.object({ id: z.uuid().optional().or(z.literal("")), question: z.string().min(5).max(200), answerMd: z.string().min(5).max(3000), category: z.string().min(2).max(40), serviceId: z.uuid().optional().or(z.literal("")), featured: bool, published: bool, sort: z.coerce.number().int().default(0) }).parse(raw);
      const row = { question: p.question, answerMd: p.answerMd, category: p.category, serviceId: p.serviceId || null, featured: p.featured, published: p.published, sort: p.sort, updatedAt: new Date(now()) };
      if (p.id) await getDb().update(s.faqs).set(row).where(eq(s.faqs.id, p.id));
      else await getDb().insert(s.faqs).values(row);
    }
    await audit(admin, "faq.save", "faq", String(raw.id ?? ""));
    bust("content");
    revalidatePath("/admin/content");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function galleryItemAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = fd(form);
    if (raw.op === "delete") {
      await getDb().delete(s.galleryItems).where(eq(s.galleryItems.id, z.uuid().parse(raw.id)));
    } else {
      const src = z.string().refine((v) => v.startsWith("/") || /^https:\/\//.test(v), "Use a site path (/images/...) or an https URL");
      const p = z.object({ id: z.uuid().optional().or(z.literal("")), title: z.string().min(2).max(80), vehicle: z.string().max(60).default(""), serviceId: z.uuid().optional().or(z.literal("")), beforeSrc: src, afterSrc: src, altBefore: z.string().min(5).max(200), altAfter: z.string().min(5).max(200), published: bool, sort: z.coerce.number().int().default(0) }).parse(raw);
      const row = { title: p.title, vehicle: p.vehicle || null, serviceId: p.serviceId || null, beforeSrc: p.beforeSrc, afterSrc: p.afterSrc, altBefore: p.altBefore, altAfter: p.altAfter, published: p.published, sort: p.sort, isPlaceholder: false, updatedAt: new Date(now()) };
      if (p.id) await getDb().update(s.galleryItems).set(row).where(eq(s.galleryItems.id, p.id));
      else await getDb().insert(s.galleryItems).values(row);
    }
    await audit(admin, "gallery.save", "gallery_item", String(raw.id ?? ""));
    bust("content");
    revalidatePath("/admin/content");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}
