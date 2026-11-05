import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { calendarEvent } from "@/lib/server/notify/calendar";

type Booking = typeof s.bookings.$inferSelect;

const booking = {
  id: "0b0c1d2e-0000-4000-8000-000000000001",
  number: "MJ-1042",
  locationType: "mobile",
  address: { line1: "500 Main St", line2: null, city: "Houston", region: "TX", postalCode: "77002", country: "US" },
  accessNotes: "Gate code 1234",
  vehicleYear: 2021,
  vehicleColor: "White",
  vehicleMake: "Ford",
  vehicleModel: "F-150",
  priceSnapshot: {
    sizeLabel: "Truck / SUV",
    lines: [
      { kind: "package", label: "Gold" },
      { kind: "addon", label: "Pet hair removal" },
      { kind: "travel", label: "Travel fee" },
    ],
  },
  totalCents: 25000,
  depositCents: 5000,
  balancePaidCents: 0,
  startsAt: new Date("2026-11-08T14:00:00Z"),
  endsAt: new Date("2026-11-08T19:00:00Z"),
  timezone: "America/Chicago",
} as unknown as Booking;

describe("U-GCAL Google Calendar event", () => {
  it("puts who, how to reach them, the car, the work, money owed and where on the event", () => {
    const e = calendarEvent(booking, { name: "Sam Rivera", email: "sam@example.com", phoneE164: "+18325550100" }, "https://example.com");
    expect(e.summary).toBe("Gold — Sam Rivera");
    expect(e.location).toBe("500 Main St, Houston, TX 77002");
    expect(e.start).toEqual({ dateTime: "2026-11-08T14:00:00.000Z", timeZone: "America/Chicago" });
    expect(e.end.dateTime).toBe("2026-11-08T19:00:00.000Z");
    expect(e.id).toMatch(/^[a-v0-9]{5,1024}$/); // Google's base32hex event-id alphabet
    const lines = e.description.split("\n");
    expect(lines).toContain("Customer: Sam Rivera");
    expect(lines.some((l) => l.startsWith("Phone: ") && l.includes("832"))).toBe(true);
    expect(lines).toContain("Vehicle: 2021 White Ford F-150 (Truck / SUV)");
    expect(lines).toContain("Services: Gold");
    expect(lines).toContain("Add-ons: Pet hair removal");
    expect(lines).toContain("Total: $250 · Deposit paid: $50 · Balance due: $200");
    expect(lines).toContain("Access notes: Gate code 1234");
    expect(e.description).toContain("https://example.com/admin/bookings/0b0c1d2e-0000-4000-8000-000000000001");
  });

  it("still makes a sensible event without a customer or vehicle details", () => {
    const e = calendarEvent({ ...booking, vehicleYear: null, vehicleColor: null, vehicleMake: null, vehicleModel: null, accessNotes: null, locationType: "shop" } as Booking, null, "https://example.com");
    expect(e.summary).toBe("Gold");
    expect(e.location).toBe("Shop");
    expect(e.description.split("\n")).toContain("Vehicle: Truck / SUV");
    expect(e.description).not.toContain("Customer:");
  });
});
