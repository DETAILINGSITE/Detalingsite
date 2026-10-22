/** Service-area resolution: ZIP match first, then radius rings from the base location. */

export interface Zone {
  id: string;
  name: string;
  zipCodes: string[];
  ringMaxKm: number | null;
  travelFeeCents: number;
  travelMinutes: number;
  sort: number;
  active: boolean;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function normalizeZip(zip: string): string {
  return zip.trim().slice(0, 5);
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ZoneMatch {
  zone: Zone;
  matchedBy: "zip" | "radius";
  distanceKm: number | null;
}

/**
 * Resolve the zone for an address. ZIP lists win (they're explicit); otherwise the
 * smallest ring that contains the point. Returns null when outside every zone.
 */
export function resolveZone(
  input: { zip?: string | null; point?: GeoPoint | null },
  zones: Zone[],
  base: GeoPoint,
): ZoneMatch | null {
  const active = zones.filter((z) => z.active).sort((a, b) => a.sort - b.sort);
  if (input.zip) {
    const zip = normalizeZip(input.zip);
    const byZip = active.find((z) => z.zipCodes.includes(zip));
    if (byZip) {
      return {
        zone: byZip,
        matchedBy: "zip",
        distanceKm: input.point ? haversineKm(base, input.point) : null,
      };
    }
  }
  if (input.point) {
    const d = haversineKm(base, input.point);
    const ring = active
      .filter((z) => z.ringMaxKm != null)
      .sort((a, b) => (a.ringMaxKm ?? 0) - (b.ringMaxKm ?? 0))
      .find((z) => d <= (z.ringMaxKm ?? 0));
    if (ring) return { zone: ring, matchedBy: "radius", distanceKm: d };
  }
  return null;
}
