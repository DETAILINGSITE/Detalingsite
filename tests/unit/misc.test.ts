import fs from "node:fs";
import { describe, expect, it } from "vitest";
import "@/config/business";
import { listPlaceholders } from "@/config/placeholder";
import { csvCell, toCsv } from "@/lib/domain/csv";
import { buildIcs, escapeText, foldLine, googleCalendarUrl } from "@/lib/domain/ics";
import { planReminders, inQuietHours } from "@/lib/domain/notifications";
import { haversineKm, resolveZone, type Zone } from "@/lib/domain/zones";
import { EnvSchema } from "@/lib/env";
import { disallowedKeys, safeVars } from "@/lib/motion/guard";
import { buildCsp, isDynamicRoute } from "@/lib/security/csp";
import { deriveToken, hashToken, looksLikeToken } from "@/lib/server/tokens";
import { ContactSchema, CustomJobSchema, LocationSchema, PhoneSchema, VehicleSchema } from "@/lib/validation/booking";
import { windowStart } from "@/lib/server/rate-limit";
import { canEnter, firstIncomplete, initialState, reducer, stepsFor } from "@/lib/booking/wizard-state";

describe("U-ZONE service area", () => {
  const base = { lat: 39.0997, lng: -94.5786 };
  const zones: Zone[] = [
    { id: "a", name: "Core", zipCodes: ["00010"], ringMaxKm: 15, travelFeeCents: 0, travelMinutes: 20, sort: 0, active: true },
    { id: "b", name: "Outer", zipCodes: [], ringMaxKm: 40, travelFeeCents: 2500, travelMinutes: 35, sort: 1, active: true },
  ];
  it("ZIP match wins", () => expect(resolveZone({ zip: "00010-1234" }, zones, base)?.zone.id).toBe("a"));
  it("radius rings pick the smallest containing ring", () => {
    const p = { lat: base.lat + 0.25, lng: base.lng }; // ≈ 27.8 km north
    expect(Math.round(haversineKm(base, p))).toBe(28);
    expect(resolveZone({ zip: "99999", point: p }, zones, base)?.zone.id).toBe("b");
  });
  it("outside every zone → null (scenario 4)", () => expect(resolveZone({ zip: "99999", point: { lat: 41, lng: -94.5 } }, zones, base)).toBeNull());
});

describe("U-VALID schemas", () => {
  it("phone normalises to E.164 and rejects junk", () => {
    expect(PhoneSchema.parse("(201) 555-0123")).toBe("+12015550123");
    expect(PhoneSchema.safeParse("12").success).toBe(false);
    expect(PhoneSchema.safeParse("").success).toBe(false);
  });
  it("contact: bad email, empty name, missing method", () => {
    const r = ContactSchema.safeParse({ name: "", phone: "nope", email: "x@", preferredContact: "fax", smsConsent: false, leadConsent: false });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["name", "phone", "email", "preferredContact"]));
  });
  it("vehicle needs a size; year range enforced", () => {
    expect(VehicleSchema.safeParse({ sizeId: "", conditionIds: [] }).success).toBe(false);
    expect(VehicleSchema.safeParse({ sizeId: "suv", year: "1800", conditionIds: [] }).success).toBe(false);
    expect(VehicleSchema.safeParse({ sizeId: "suv", year: "2021", conditionIds: [] }).success).toBe(true);
  });
  it("mobile location requires a full address and 5-digit ZIP", () => {
    expect(LocationSchema.safeParse({ locationType: "mobile", address: { line1: "1 A St", city: "X", region: "TX", postalCode: "123", country: "US" }, hasWater: true, hasPower: true }).success).toBe(false);
    expect(LocationSchema.safeParse({ locationType: "shop" }).success).toBe(true);
  });
  it("custom job: description length and ≤10 photos", () => {
    expect(CustomJobSchema.safeParse({ description: "short", photoIds: [], preferredDates: [], serviceIds: [] }).success).toBe(false);
    const ids = Array.from({ length: 11 }, () => crypto.randomUUID());
    expect(CustomJobSchema.safeParse({ description: "x".repeat(30), photoIds: ids, preferredDates: [], serviceIds: [] }).success).toBe(false);
  });
});

describe("U-TOKEN signed links", () => {
  it("derivation is deterministic per id+version and version bump revokes", () => {
    const a = deriveToken("pepper-0123456789", "manage", "id1", 1);
    expect(a).toBe(deriveToken("pepper-0123456789", "manage", "id1", 1));
    expect(a).not.toBe(deriveToken("pepper-0123456789", "manage", "id1", 2));
    expect(a).not.toBe(deriveToken("pepper-0123456789", "quote", "id1", 1));
    expect(looksLikeToken(a)).toBe(true);
    expect(hashToken(a)).toHaveLength(32);
  });
});

describe("U-ICS calendar", () => {
  it("escapes, folds long lines and emits UTC times", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const folded = foldLine("X".repeat(200));
    expect(folded.split("\r\n ").every((l) => l.length <= 75)).toBe(true);
    const ics = buildIcs({ uid: "u@x", start: new Date("2026-11-03T15:00:00Z"), end: new Date("2026-11-03T17:00:00Z"), stamp: new Date("2026-10-22T00:00:00Z"), summary: "Detail, full" });
    expect(ics).toContain("DTSTART:20261103T150000Z");
    expect(ics).toContain("SUMMARY:Detail\\, full");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(googleCalendarUrl({ start: new Date("2026-11-03T15:00:00Z"), end: new Date("2026-11-03T17:00:00Z"), summary: "x" })).toContain("dates=20261103T150000Z%2F20261103T170000Z");
  });
});

describe("U-CSV export", () => {
  it("neutralises formula injection and quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell(5)).toBe("5");
    expect(toCsv([{ a: "@x" }], [{ header: "A", value: (r) => r.a }])).toBe("﻿A\r\n'@x\r\n");
  });
});

describe("U-NOTIFY reminder timing", () => {
  const tz = "America/Chicago";
  it("24h and 2h reminders; skipped when booked too late", () => {
    const start = Date.parse("2026-11-10T16:00:00Z"); // 10am CST
    const plans = planReminders({ startsAt: start, now: start - 30 * 3_600_000, hoursBefore: [24, 2], tz, quietStart: "21:00", quietEnd: "08:00" });
    expect(plans.map((p) => p.hoursBefore)).toEqual([24, 2]);
    expect(plans[1]!.smsAt).toBe(Date.parse("2026-11-10T14:00:00Z")); // 8am exactly — not quiet
    const late = planReminders({ startsAt: start, now: start - 3 * 3_600_000, hoursBefore: [24, 2], tz, quietStart: "21:00", quietEnd: "08:00" });
    expect(late.map((p) => p.hoursBefore)).toEqual([2]);
  });
  it("SMS moved out of quiet hours, or dropped when too close", () => {
    const eight = Date.parse("2026-11-10T14:00:00Z"); // 8am appointment → 2h reminder at 6am (quiet)
    const p = planReminders({ startsAt: eight, now: eight - 48 * 3_600_000, hoursBefore: [2], tz, quietStart: "21:00", quietEnd: "08:00" })[0]!;
    expect(p.smsAt).toBeNull();
    expect(inQuietHours(Date.parse("2026-11-10T04:00:00Z"), tz, "21:00", "08:00")).toBe(true);
  });
});

describe("U-CSP & U-MOTION-GUARD", () => {
  it("strict policy uses nonce + strict-dynamic and never unsafe-eval in prod", () => {
    const strict = buildCsp({ mode: "strict", nonce: "abc", dev: false });
    expect(strict).toContain("'nonce-abc'");
    expect(strict).toContain("'strict-dynamic'");
    expect(strict).not.toContain("unsafe-eval");
    expect(buildCsp({ mode: "static", dev: false })).toContain("frame-ancestors 'none'");
    expect(isDynamicRoute("/admin/bookings")).toBe(true);
    expect(isDynamicRoute("/quote")).toBe(false);
    expect(isDynamicRoute(`/quote/${"a".repeat(43)}`)).toBe(true);
  });
  it("only transform/opacity may be animated", () => {
    expect(disallowedKeys({ y: 10, opacity: 1, duration: 1 })).toEqual([]);
    expect(disallowedKeys({ width: 10, top: 0, height: 1 })).toEqual(["width", "top", "height"]);
    expect(() => safeVars({ marginTop: 4 })).toThrow(/transform\/opacity/);
  });
});

describe("U-ENV & U-CONFIG", () => {
  it("every env var in the schema is documented in .env.example", () => {
    const example = fs.readFileSync(".env.example", "utf8");
    for (const key of Object.keys(EnvSchema.shape)) {
      if (key === "NODE_ENV") continue;
      expect(example, key).toMatch(new RegExp(`^#?\\s*${key}=`, "m"));
    }
  });
  it("every config placeholder is listed in the README 'Values to fill in'", () => {
    const readme = fs.readFileSync("README.md", "utf8");
    for (const p of listPlaceholders()) expect(readme, p.key).toContain(p.key);
  });
});

describe("U-RATE & U-WIZARD", () => {
  it("rate-limit windows are aligned", () => {
    expect(windowStart(Date.parse("2026-11-03T15:07:31Z"), 600).toISOString()).toBe("2026-11-03T15:00:00.000Z");
  });
  it("wizard guards deep links and orders steps per path", () => {
    let s = initialState({ uuid: () => crypto.randomUUID() });
    expect(stepsFor(s)[0]).toBe("path");
    expect(canEnter(s, "contact")).toBe(false);
    s = reducer(s, { type: "setPath", path: "service" });
    s = reducer(s, { type: "vehicle", patch: { sizeId: "suv" } });
    expect(firstIncomplete(s)).toBe("services");
    expect(stepsFor({ path: "custom", quoteToken: null })).toEqual(["path", "vehicle", "custom", "location", "contact", "submitted"]);
    expect(stepsFor({ path: "service", quoteToken: "t" })).toEqual(["schedule", "contact", "review"]);
  });
});
