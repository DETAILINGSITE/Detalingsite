/**
 * Server-side proxy for Google Places API (New). The key never reaches the browser.
 * Sessions: autocomplete requests share a sessionToken that the Place Details call
 * closes, so keystrokes are billed as one session.
 */
import { env } from "@/lib/env";

export interface PlaceSuggestion {
  placeId: string;
  text: string;
  secondary: string;
}

export interface PlaceAddress {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
  placeId: string;
}

export const placesEnabled = () => Boolean(env().GOOGLE_MAPS_SERVER_KEY);

export async function autocomplete(input: string, sessionToken: string, bias: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
  const key = env().GOOGLE_MAPS_SERVER_KEY;
  if (!key) return [];
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      locationBias: { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50_000 } },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Places autocomplete ${res.status}`);
  const data = (await res.json()) as {
    suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } }; text?: { text: string } } }[];
  };
  return (data.suggestions ?? [])
    .map((sug) => sug.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 5)
    .map((p) => ({
      placeId: p.placeId,
      text: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export async function placeDetails(placeId: string, sessionToken: string): Promise<PlaceAddress | null> {
  const key = env().GOOGLE_MAPS_SERVER_KEY;
  if (!key || !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?sessionToken=${encodeURIComponent(sessionToken)}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "addressComponents,location,formattedAddress" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Places details ${res.status}`);
  const data = (await res.json()) as {
    addressComponents?: { longText: string; shortText: string; types: string[] }[];
    location?: { latitude: number; longitude: number };
  };
  const get = (type: string, short = false) => {
    const c = data.addressComponents?.find((x) => x.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : "";
  };
  if (!data.location) return null;
  return {
    line1: [get("street_number"), get("route")].filter(Boolean).join(" "),
    city: get("locality") || get("postal_town") || get("sublocality") || get("administrative_area_level_2"),
    region: get("administrative_area_level_1", true),
    postalCode: get("postal_code"),
    country: get("country", true) || "US",
    lat: data.location.latitude,
    lng: data.location.longitude,
    placeId,
  };
}
