/**
 * Seeds the database from config/business.ts defaults and db/seed-data/*.
 *
 *   pnpm db:seed           # insert anything missing; never overwrites admin edits
 *   pnpm db:seed --reset   # DEV ONLY: wipe catalog/content/schedule tables first
 */
import { sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { business } from "@/config/business";
import { createDb, createPool, type Db } from "./client";
import * as s from "./schema";
import {
  seedCategories,
  seedConditions,
  seedPackages,
  seedRules,
  seedServices,
  seedSizes,
} from "./seed-data/catalog";
import { seedCityPages, seedFaqs, seedGallery, seedPromos, seedTestimonials } from "./seed-data/content";

export async function seed(db: Db, opts: { reset?: boolean; log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => {});

  if (opts.reset) {
    await db.execute(sql`TRUNCATE
      resource_allocations, booking_events, payments, outbox, leads, quote_photos, funnel_events,
      bookings, quote_requests, customers, webhook_events, rate_limits,
      package_items, package_size_prices, service_size_prices, service_rules, packages, services,
      service_categories, conditions, vehicle_sizes, promo_codes, testimonials, gallery_items, faqs,
      city_pages, service_zones, resources, business_hours, blackout_dates, settings
      RESTART IDENTITY CASCADE`);
    log("reset: truncated seeded tables");
  }

  await db.transaction(async (tx) => {
    // Settings (single row) — admin-owned after this.
    await tx
      .insert(s.settings)
      .values({ id: 1, data: business.defaults.settings })
      .onConflictDoNothing();

    // Schedule defaults — only when empty so admin edits are never overwritten.
    const [{ n: hourCount } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.businessHours);
    if (hourCount === 0) {
      await tx.insert(s.businessHours).values(business.defaults.hours.map((h) => ({ ...h })));
    }
    if (business.defaults.blackoutDates.length) {
      await tx
        .insert(s.blackoutDates)
        .values(business.defaults.blackoutDates.map((b) => ({ ...b })))
        .onConflictDoNothing();
    }
    const [{ n: resourceCount } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.resources);
    if (resourceCount === 0) {
      await tx
        .insert(s.resources)
        .values(business.defaults.resources.map((r, i) => ({ ...r, sort: i })));
    }
    const [{ n: zoneCount } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.serviceZones);
    let zoneIds: string[] = [];
    if (zoneCount === 0) {
      const rows = await tx
        .insert(s.serviceZones)
        .values(
          business.defaults.zones.map((z, i) => ({
            name: z.name,
            zipCodes: [...z.zipCodes],
            ringMaxKm: z.ringMaxKm,
            travelFeeCents: z.travelFeeCents,
            travelMinutes: z.travelMinutes,
            cities: [...z.cities],
            sort: i,
          })),
        )
        .returning({ id: s.serviceZones.id });
      zoneIds = rows.map((r) => r.id);
    } else {
      zoneIds = (await tx.select({ id: s.serviceZones.id }).from(s.serviceZones).orderBy(s.serviceZones.sort)).map(
        (r) => r.id,
      );
    }

    // Catalog
    await tx
      .insert(s.vehicleSizes)
      .values(seedSizes.map((z) => ({ ...z })))
      .onConflictDoNothing();
    await tx
      .insert(s.serviceCategories)
      .values(seedCategories.map((c) => ({ ...c })))
      .onConflictDoNothing();
    const categories = await tx.select().from(s.serviceCategories);
    const categoryId = new Map(categories.map((c) => [c.slug, c.id]));

    await tx
      .insert(s.services)
      .values(
        seedServices.map((svc) => ({
          slug: svc.slug,
          categoryId: categoryId.get(svc.category) ?? null,
          kind: svc.kind,
          name: svc.name,
          summary: svc.summary,
          descriptionMd: svc.descriptionMd,
          includes: svc.includes,
          whatToExpect: svc.whatToExpect,
          basePriceCents: svc.basePriceCents,
          baseDurationMin: svc.baseDurationMin,
          quoteOnly: svc.quoteOnly ?? false,
          locationTypes: svc.locationTypes ?? ["mobile", "shop"],
          sort: svc.sort,
          isPlaceholder: !svc.real,
        })),
      )
      .onConflictDoNothing();
    const services = await tx.select({ id: s.services.id, slug: s.services.slug }).from(s.services);
    const serviceId = new Map(services.map((x) => [x.slug, x.id]));

    for (const svc of seedServices) {
      const id = serviceId.get(svc.slug);
      if (!id || !svc.sizeOverrides) continue;
      for (const [sizeId, o] of Object.entries(svc.sizeOverrides)) {
        await tx
          .insert(s.serviceSizePrices)
          .values({ serviceId: id, sizeId, priceCents: o?.priceCents ?? null, durationMin: o?.durationMin ?? null })
          .onConflictDoNothing();
      }
    }

    await tx
      .insert(s.packages)
      .values(
        seedPackages.map((p) => ({
          slug: p.slug,
          name: p.name,
          tier: p.tier,
          tagline: p.tagline,
          basePriceCents: p.basePriceCents,
          baseDurationMin: p.baseDurationMin,
          featured: p.featured,
          sort: p.sort,
          isPlaceholder: false,
        })),
      )
      .onConflictDoNothing();
    const pkgs = await tx.select({ id: s.packages.id, slug: s.packages.slug }).from(s.packages);
    const packageId = new Map(pkgs.map((p) => [p.slug, p.id]));
    for (const p of seedPackages) {
      const pid = packageId.get(p.slug);
      if (!pid) continue;
      for (const slug of p.services) {
        const sid = serviceId.get(slug);
        if (sid) await tx.insert(s.packageItems).values({ packageId: pid, serviceId: sid }).onConflictDoNothing();
      }
      for (const [sizeId, o] of Object.entries(p.sizeOverrides)) {
        await tx
          .insert(s.packageSizePrices)
          .values({ packageId: pid, sizeId, priceCents: o?.priceCents ?? null, durationMin: o?.durationMin ?? null })
          .onConflictDoNothing();
      }
    }

    for (const r of seedRules) {
      const a = serviceId.get(r.service);
      const b = serviceId.get(r.target);
      if (a && b)
        await tx
          .insert(s.serviceRules)
          .values({ kind: r.kind, serviceId: a, targetServiceId: b, reason: r.reason })
          .onConflictDoNothing();
    }

    await tx
      .insert(s.conditions)
      .values(seedConditions.map((c) => ({ ...c })))
      .onConflictDoNothing();
    await tx
      .insert(s.promoCodes)
      .values(seedPromos.map((p) => ({ ...p })))
      .onConflictDoNothing();

    // Content — only when empty.
    const [{ n: testimonialCount } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.testimonials);
    if (testimonialCount === 0 && seedTestimonials.length > 0) await tx.insert(s.testimonials).values(seedTestimonials);

    const [{ n: galleryCount } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.galleryItems);
    if (galleryCount === 0 && seedGallery.length > 0) {
      await tx.insert(s.galleryItems).values(
        seedGallery.map((g) => ({
          title: g.title,
          vehicle: g.vehicle,
          serviceId: serviceId.get(g.service) ?? null,
          beforeSrc: g.beforeSrc,
          afterSrc: g.afterSrc,
          altBefore: g.altBefore,
          altAfter: g.altAfter,
          sort: g.n,
        })),
      );
    }

    const [{ n: faqCount } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.faqs);
    if (faqCount === 0) {
      await tx.insert(s.faqs).values(seedFaqs.map((f, i) => ({ ...f, sort: i })));
    }

    await tx
      .insert(s.cityPages)
      .values(
        seedCityPages.map((c) => ({
          slug: c.slug,
          city: c.city,
          region: c.region,
          zoneId: zoneIds[c.zoneIndex] ?? null,
          introMd: c.introMd,
          isPlaceholder: false,
        })),
      )
      .onConflictDoNothing();
  });
  log("seed: done");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const reset = process.argv.includes("--reset");
  if (reset && process.env.NODE_ENV === "production") {
    console.error("Refusing to --reset in production.");
    process.exit(1);
  }
  const pool = createPool(url, 2);
  seed(createDb(pool), { reset, log: console.log })
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
