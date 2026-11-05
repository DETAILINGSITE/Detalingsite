import { describe, expect, it } from "vitest";
import { blockedRange, computeAvailability, freeResourcesAt, nearestSlots, type AvailabilityInput } from "@/lib/domain/availability";

const TZ = "America/Chicago";
const weekdays = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "08:00", closes: "18:00" }));

function input(p: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    fromDate: "2026-11-03",
    toDate: "2026-11-03",
    durationMin: 60,
    travelMin: 0,
    resourceIds: ["r1"],
    allocations: [],
    hours: weekdays,
    blackoutDates: [],
    settings: { timezone: TZ, slotIntervalMin: 30, bufferMin: 0, minLeadHours: 0, maxDaysAhead: 365, travelCountsAgainstHours: false },
    now: Date.parse("2026-10-22T12:00:00Z"),
    ...p,
  };
}
const starts = (p: Partial<AvailabilityInput>) => computeAvailability(input(p)).flatMap((d) => d.slots.map((s) => s.start));
const labels = (p: Partial<AvailabilityInput>) => computeAvailability(input(p)).flatMap((d) => d.slots.map((s) => s.label));

describe("U-AVAIL availability engine", () => {
  it("U-AVAIL-01 business hours: first and last start for a 60-minute job (Tue 2026-11-03, CST)", () => {
    const l = labels({});
    expect(l[0]).toBe("8:00 AM");
    expect(l.at(-1)).toBe("5:30 PM");
    expect(l).toHaveLength(20);
    expect(starts({})[0]).toBe("2026-11-03T14:00:00.000Z"); // 8am CST = UTC-6
  });

  it("U-AVAIL-02 closed weekday and blackout dates produce no slots", () => {
    expect(starts({ fromDate: "2026-11-08", toDate: "2026-11-08" })).toHaveLength(0); // Sunday
    expect(starts({ blackoutDates: ["2026-11-03"] })).toHaveLength(0);
  });

  it("U-AVAIL-03 long jobs get every start time from opening to closing (owner's choice: they may run past closing)", () => {
    const l = labels({ durationMin: 450 });
    expect(l[0]).toBe("8:00 AM");
    expect(l.at(-1)).toBe("5:30 PM");
    expect(l).toHaveLength(20);
    expect(computeAvailability(input({ durationMin: 450 }))[0]!.slots.at(-1)!.end).toBe("2026-11-04T07:00:00.000Z"); // 5:30 PM + 7½ h = 1:00 AM CST
  });

  it("U-AVAIL-04 capacity: two crews, one busy → capacity 1; both busy → slot gone", () => {
    const busy = { resourceId: "r1", start: Date.parse("2026-11-03T15:00:00Z"), end: Date.parse("2026-11-03T16:00:00Z") };
    const days = computeAvailability(input({ resourceIds: ["r1", "r2"], allocations: [busy] }));
    const nine = days[0]!.slots.find((s) => s.start === "2026-11-03T15:00:00.000Z")!;
    expect(nine.capacity).toBe(1);
    expect(nine.freeResourceIds).toEqual(["r2"]);
    const both = starts({ resourceIds: ["r1", "r2"], allocations: [busy, { ...busy, resourceId: "r2" }] });
    expect(both).not.toContain("2026-11-03T15:00:00.000Z");
  });

  it("U-AVAIL-05 buffer and travel are reserved around the job", () => {
    const busy = { resourceId: "r1", start: Date.parse("2026-11-03T15:00:00Z"), end: Date.parse("2026-11-03T16:00:00Z") }; // 9–10am
    const s = starts({ allocations: [busy], travelMin: 20, settings: { ...input().settings, bufferMin: 30 } });
    // 8:00 job ends 9:00 + 30 buffer → overlaps 9:00; 7:30 n/a; 10:00 needs travel from 9:40 → overlaps until 10:00
    expect(s).not.toContain("2026-11-03T14:00:00.000Z");
    expect(s).not.toContain("2026-11-03T16:00:00.000Z");
    expect(s).toContain("2026-11-03T16:30:00.000Z");
    expect(blockedRange(0, 60, 20, 30)).toEqual({ start: -20 * 60_000, end: 90 * 60_000 });
  });

  it("U-AVAIL-06 travel can be required to fit inside opening hours", () => {
    const s = starts({ travelMin: 20, settings: { ...input().settings, travelCountsAgainstHours: true } });
    expect(s[0]).toBe("2026-11-03T14:30:00.000Z");
  });

  it("U-AVAIL-07 expired holds don't block; live holds do (scenario 7)", () => {
    const hold = { resourceId: "r1", start: Date.parse("2026-11-03T15:00:00Z"), end: Date.parse("2026-11-03T16:00:00Z") };
    const now = Date.parse("2026-10-22T12:00:00Z");
    expect(starts({ now, allocations: [{ ...hold, holdExpiresAt: now - 1 }] })).toContain("2026-11-03T15:00:00.000Z");
    expect(starts({ now, allocations: [{ ...hold, holdExpiresAt: now + 60_000 }] })).not.toContain("2026-11-03T15:00:00.000Z");
  });

  it("U-AVAIL-08 minimum lead time and max days ahead", () => {
    const now = Date.parse("2026-11-03T13:00:00Z"); // 7am local
    const s = starts({ now, settings: { ...input().settings, minLeadHours: 3 } });
    expect(s[0]).toBe("2026-11-03T16:00:00.000Z"); // 10am
    expect(starts({ now, fromDate: "2026-11-10", toDate: "2026-11-10", settings: { ...input().settings, maxDaysAhead: 5 } })).toHaveLength(0);
  });

  it("U-AVAIL-09 DST fall-back (2026-11-01): wall-clock slots, no duplicates, correct offsets", () => {
    const allDay = [{ weekday: 7, opens: "00:00", closes: "23:59" }];
    const days = computeAvailability(input({ fromDate: "2026-11-01", toDate: "2026-11-01", hours: allDay }));
    const slots = days[0]!.slots;
    const startSet = new Set(slots.map((s) => s.start));
    expect(startSet.size).toBe(slots.length);
    expect(new Set(slots.map((s) => s.label)).size).toBe(slots.length);
    expect(slots.find((s) => s.label === "1:00 AM")!.start).toBe("2026-11-01T06:00:00.000Z"); // first (CDT) occurrence
    expect(slots.find((s) => s.label === "3:00 AM")!.start).toBe("2026-11-01T09:00:00.000Z"); // CST
    expect(slots.at(-1)!.label).toBe("11:30 PM");
  });

  it("U-AVAIL-10 DST spring-forward (2027-03-14): nonexistent 2:00–2:59 never offered", () => {
    const allDay = [{ weekday: 7, opens: "00:00", closes: "23:59" }];
    const l = labels({ fromDate: "2027-03-14", toDate: "2027-03-14", hours: allDay, now: Date.parse("2027-03-01T00:00:00Z") });
    expect(l).not.toContain("2:00 AM");
    expect(l).not.toContain("2:30 AM");
    expect(l).toContain("3:00 AM");
    expect(l).toContain("1:30 AM");
  });

  it("U-AVAIL-11 the Monday after fall-back still opens at 8:00 local (not shifted)", () => {
    const fri = starts({ fromDate: "2026-10-30", toDate: "2026-10-30" })[0];
    const mon = starts({ fromDate: "2026-11-02", toDate: "2026-11-02" })[0];
    expect(fri).toBe("2026-10-30T13:00:00.000Z");
    expect(mon).toBe("2026-11-02T14:00:00.000Z");
  });

  it("U-AVAIL-12 timezone without DST (Pacific/Honolulu)", () => {
    const s = starts({ settings: { ...input().settings, timezone: "Pacific/Honolulu" } });
    expect(s[0]).toBe("2026-11-03T18:00:00.000Z");
  });

  it("U-AVAIL-13 split hours (lunch break) and slot interval", () => {
    const hours = [{ weekday: 2, opens: "08:00", closes: "12:00" }, { weekday: 2, opens: "13:00", closes: "17:00" }];
    const l = labels({ hours, settings: { ...input().settings, slotIntervalMin: 60 } });
    expect(l).toEqual(["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"]);
  });

  it("freeResourcesAt and nearestSlots", () => {
    expect(freeResourcesAt(input({ resourceIds: ["a", "b"] }), "2026-11-03T15:00:00.000Z")).toEqual(["a", "b"]);
    expect(freeResourcesAt(input(), "2026-11-03T15:10:00.000Z")).toEqual([]); // not on the grid
    const near = nearestSlots(computeAvailability(input()), "2026-11-03T15:00:00.000Z", 3);
    expect(near.map((s) => s.start)).toEqual(["2026-11-03T14:30:00.000Z", "2026-11-03T15:30:00.000Z", "2026-11-03T14:00:00.000Z"].sort());
  });
});
