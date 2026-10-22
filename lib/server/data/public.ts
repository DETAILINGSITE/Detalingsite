/**
 * Cached reads for the prerendered marketing pages (Cache Components).
 * Admin mutations call revalidateTag("catalog" | "content" | "settings", "max").
 */
import { and, asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { fromPrice, priceForItem, durationForItem } from "@/lib/domain/pricing";
import { loadCatalog } from "./catalog";
import { loadSchedule, loadSettings } from "./settings";

export const CACHE_TAGS = { catalog: "catalog", content: "content", settings: "settings" } as const;

export async function getPublicCatalog() {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.catalog, CACHE_TAGS.settings);
  const db = getDb();
  const [catalog, settings] = await Promise.all([loadCatalog(db, { activeOnly: true }), loadSettings(db)]);
  const rounding = settings.priceRoundingCents;
  const priceTable = (item: Parameters<typeof priceForItem>[0] & Parameters<typeof durationForItem>[0]) =>
    Object.fromEntries(
      catalog.sizes.map((z) => [z.id, { priceCents: priceForItem(item, z, rounding), durationMin: durationForItem(item, z) }]),
    );
  return {
    ...catalog,
    services: catalog.services.map((x) => ({
      ...x,
      fromCents: fromPrice(x, catalog.sizes, rounding),
      bySize: priceTable(x),
    })),
    packages: catalog.packages.map((p) => ({
      ...p,
      fromCents: fromPrice(p, catalog.sizes, rounding),
      bySize: priceTable(p),
      includedNames: p.serviceIds
        .map((id) => catalog.services.find((x) => x.id === id)?.name)
        .filter((n): n is string => Boolean(n)),
    })),
    deposit: settings.deposit,
    taxRateBps: settings.taxRateBps,
    taxTravel: settings.taxTravel,
    priceRoundingCents: settings.priceRoundingCents,
    cancellation: settings.cancellation,
    reschedule: settings.reschedule,
  };
}

export type PublicCatalog = Awaited<ReturnType<typeof getPublicCatalog>>;

export async function getPublicSchedule() {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.settings);
  const db = getDb();
  const [schedule, settings] = await Promise.all([loadSchedule(db), loadSettings(db)]);
  return {
    hours: schedule.hours,
    zones: schedule.zones
      .filter((z) => z.active)
      .map((z) => ({ id: z.id, name: z.name, zipCodes: z.zipCodes, travelFeeCents: z.travelFeeCents, cities: schedule.zoneCities[z.id] ?? [] })),
    serviceMode: settings.serviceMode,
    timezone: settings.timezone,
  };
}

export async function getPublicContent() {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.content);
  const db = getDb();
  const [testimonials, gallery, faqs, cities] = await Promise.all([
    db.select().from(s.testimonials).where(eq(s.testimonials.published, true)).orderBy(asc(s.testimonials.sort)),
    db.select().from(s.galleryItems).where(eq(s.galleryItems.published, true)).orderBy(asc(s.galleryItems.sort)),
    db.select().from(s.faqs).where(eq(s.faqs.published, true)).orderBy(asc(s.faqs.category), asc(s.faqs.sort)),
    db.select().from(s.cityPages).where(eq(s.cityPages.published, true)).orderBy(asc(s.cityPages.city)),
  ]);
  return { testimonials, gallery, faqs, cities };
}

export async function getCityPage(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.content);
  const [row] = await getDb()
    .select()
    .from(s.cityPages)
    .where(and(eq(s.cityPages.slug, slug), eq(s.cityPages.published, true)));
  return row ?? null;
}
