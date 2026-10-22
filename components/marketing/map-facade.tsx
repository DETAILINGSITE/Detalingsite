"use client";
/** Map facade: no third-party iframe (or cookies) until the visitor asks for it. */
import { MapPin } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MapFacade({ query, label, mapsUrl }: { query: string; label: string; mapsUrl: string }) {
  const [show, setShow] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  if (show && key) {
    return (
      <iframe
        title={`Map: ${label}`}
        src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}`}
        className="aspect-[4/3] w-full rounded-[var(--radius-card)] border border-white/10"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }
  return (
    <div className="card flex aspect-[4/3] flex-col items-center justify-center gap-4 p-6 text-center">
      <MapPin className="size-10 text-gold-300" aria-hidden="true" />
      <p className="font-semibold">{label}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {key && (
          <Button variant="secondary" size="sm" onClick={() => setShow(true)}>
            Show map
          </Button>
        )}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-gold-300 underline">
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
