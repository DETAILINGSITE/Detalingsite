"use client";
/**
 * Accessible address combobox (ARIA 1.2 combobox + listbox) backed by our server-side
 * Places proxy. Degrades to a plain text field when Places isn't configured.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/field";

interface Suggestion {
  placeId: string;
  text: string;
  secondary: string;
}

export interface PickedAddress {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  lat: number;
  lng: number;
  placeId: string;
}

export function AddressAutocomplete({
  id,
  value,
  onChange,
  onPick,
  enabled,
  invalid,
  describedById,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (a: PickedAddress) => void;
  enabled: boolean;
  invalid?: boolean;
  describedById?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const session = useRef<string | null>(null);
  const listId = useId();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled || value.trim().length < 3) {
      setItems([]);
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      session.current ??= crypto.randomUUID();
      try {
        const res = await fetch(`/api/places/autocomplete?${new URLSearchParams({ q: value, session: session.current })}`);
        const json = (await res.json()) as { suggestions: Suggestion[] };
        setItems(json.suggestions ?? []);
        setOpen((json.suggestions ?? []).length > 0);
        setActive(-1);
      } catch {
        setItems([]);
      }
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [value, enabled]);

  const pick = async (s: Suggestion) => {
    setOpen(false);
    onChange(s.text);
    try {
      const res = await fetch(`/api/places/details?${new URLSearchParams({ id: s.placeId, session: session.current ?? crypto.randomUUID() })}`);
      const json = (await res.json()) as { address: PickedAddress | null };
      if (json.address) onPick(json.address);
    } finally {
      session.current = null; // the details call closes the billing session
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        role={enabled ? "combobox" : undefined}
        aria-autocomplete={enabled ? "list" : undefined}
        aria-expanded={enabled ? open : undefined}
        aria-controls={enabled ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        autoComplete="address-line1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && active >= 0 && items[active]) {
            e.preventDefault();
            void pick(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {enabled && open && (
        <ul id={listId} role="listbox" aria-label="Address suggestions" className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-2xl">
          {items.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(s);
              }}
              className="cursor-pointer px-4 py-3 text-sm aria-selected:bg-white/[0.08] hover:bg-white/[0.06]"
            >
              <span className="block text-fg">{s.text}</span>
              <span className="block text-fg-subtle">{s.secondary}</span>
            </li>
          ))}
          <li role="presentation" className="px-4 py-2 text-right text-[0.7rem] text-fg-subtle">Powered by Google</li>
        </ul>
      )}
    </div>
  );
}
