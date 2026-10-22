import type { AddressJson } from "@/db/schema";
import { resolveZone, type Zone } from "@/lib/domain/zones";
import type { LocationInput } from "@/lib/validation/booking";
import { serviceModeAllows } from "../data/settings";
import type { BookingContext } from "./context";

export type ResolvedLocation =
  | {
      ok: true;
      locationType: "mobile" | "shop";
      zone: Zone | null;
      address: AddressJson | null;
      accessNotes: string | null;
      travelMinutes: number;
    }
  | { ok: false; code: "OUT_OF_AREA" | "LOCATION_TYPE_UNAVAILABLE"; message: string };

type ParsedLocation =
  | {
      locationType: "mobile";
      address: Omit<AddressJson, "country"> & { country: string };
      accessNotes?: string;
      hasWater: boolean;
      hasPower: boolean;
    }
  | { locationType: "shop" };

export function resolveLocation(ctx: BookingContext, location: LocationInput | ParsedLocation): ResolvedLocation {
  const mode = ctx.settings.serviceMode;
  if (!serviceModeAllows(mode, location.locationType)) {
    return {
      ok: false,
      code: "LOCATION_TYPE_UNAVAILABLE",
      message:
        location.locationType === "mobile"
          ? "We only work at our shop right now."
          : "We're mobile-only right now — we'll come to you.",
    };
  }
  if (location.locationType === "shop") {
    return { ok: true, locationType: "shop", zone: null, address: null, accessNotes: null, travelMinutes: 0 };
  }
  const a = location.address;
  const point = a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null;
  const match = resolveZone({ zip: a.postalCode, point }, ctx.schedule.zones, ctx.settings.base);
  if (!match) {
    return {
      ok: false,
      code: "OUT_OF_AREA",
      message: "That address is outside our regular service area.",
    };
  }
  const notes = [
    `Water access: ${location.hasWater ? "yes" : "no"}`,
    `Power access: ${location.hasPower ? "yes" : "no"}`,
    location.accessNotes ? `Notes: ${location.accessNotes}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    ok: true,
    locationType: "mobile",
    zone: match.zone,
    address: {
      line1: a.line1,
      ...(a.line2 ? { line2: a.line2 } : {}),
      city: a.city,
      region: a.region,
      postalCode: a.postalCode,
      country: a.country,
      ...(point ? { lat: point.lat, lng: point.lng } : {}),
      ...(a.placeId ? { placeId: a.placeId } : {}),
    },
    accessNotes: notes,
    travelMinutes: match.zone.travelMinutes,
  };
}

/** Conservative travel time when a quoted out-of-area job has no zone. */
export function maxZoneTravel(ctx: BookingContext): number {
  return Math.max(0, ...ctx.schedule.zones.filter((z) => z.active).map((z) => z.travelMinutes));
}

export function formatAddress(a: AddressJson | null | undefined): string {
  if (!a) return "";
  return [a.line1, a.line2, `${a.city}, ${a.region} ${a.postalCode}`].filter(Boolean).join(", ");
}
