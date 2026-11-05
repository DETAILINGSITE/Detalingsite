"use client";
import { CalendarX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { createHoldAction, releaseHoldAction } from "@/app/(flow)/book/actions";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/radio-cards";
import { getAttribution } from "@/lib/analytics/track";
import { priceSummary } from "@/lib/booking/summary";
import { selectionOf, signatureOf, toLocalClock } from "@/lib/booking/wizard-state";
import { formatDuration } from "@/lib/domain/money";
import { formatDateLong } from "@/lib/domain/time";
import { StepShell } from "../step-shell";
import type { StepProps } from "./types";

interface SlotData {
  start: string;
  end: string;
  label: string;
  capacity: number;
}
interface AvailabilityOk {
  ok: true;
  timezone: string;
  zoneLabel: string;
  durationMin: number;
  firstBookableDate: string;
  lastBookableDate: string;
  days: { date: string; slots: SlotData[] }[];
  nextAvailable: { date: string; start: string; label: string } | null;
}
type AvailabilityErr = { ok: false; code: string; message: string };

function ymd(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function ScheduleStep({ state, dispatch, data, onNext, onBack, onSwitchToQuote, notice }: StepProps & { onSwitchToQuote: () => void; notice?: string | null }) {
  const tz = data.timezone;
  const [avail, setAvail] = useState<AvailabilityOk | null>(null);
  const [loadError, setLoadError] = useState<AvailabilityErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(state.hold ? ymd(new Date(state.hold.startsAt), tz) : null);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [alternatives, setAlternatives] = useState<SlotData[]>([]);
  const signature = signatureOf(state);
  const statusRef = useRef<HTMLParagraphElement>(null);

  // A hold for a different selection is stale: release it.
  useEffect(() => {
    if (state.hold && state.hold.signature !== signature) {
      void releaseHoldAction({ token: state.hold.token });
      dispatch({ type: "hold", hold: null, newKey: crypto.randomUUID() });
    }
  }, [signature, state.hold, dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const sel = selectionOf(state);
    const params = new URLSearchParams({
      size: sel.sizeId || "sedan",
      loc: state.location.locationType ?? "shop",
      days: "42",
    });
    if (sel.packageId) params.set("pkg", sel.packageId);
    if (sel.serviceIds.length) params.set("svc", sel.serviceIds.join(","));
    if (sel.addonIds.length) params.set("add", sel.addonIds.join(","));
    if (sel.conditionIds.length) params.set("cond", sel.conditionIds.join(","));
    const a = state.location.address;
    if (state.location.locationType === "mobile" && a.postalCode) params.set("zip", a.postalCode.slice(0, 5));
    if (a.lat != null && a.lng != null) {
      params.set("lat", String(a.lat));
      params.set("lng", String(a.lng));
    }
    if (state.quoteToken) params.set("quote", state.quoteToken);
    if (fromDate) params.set("from", fromDate);
    try {
      const res = await fetch(`/api/availability?${params}`, { cache: "no-store" });
      const json = (await res.json()) as AvailabilityOk | AvailabilityErr;
      if (json.ok) {
        setAvail(json);
        if (!selectedDate && json.days[0]) setSelectedDate(json.days[0].date);
      } else setLoadError(json);
    } catch {
      setLoadError({ ok: false, code: "NETWORK", message: "We couldn't load available times. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, fromDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches availability; the loading flag is set by design
    void load();
  }, [load]);

  const byDate = useMemo(() => new Map((avail?.days ?? []).map((d) => [d.date, d.slots])), [avail]);
  const slots = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  const hold = async (startIso: string) => {
    setHolding(true);
    setError(null);
    setAlternatives([]);
    if (state.hold && state.hold.startsAt !== startIso) void releaseHoldAction({ token: state.hold.token });
    const key = state.hold && state.hold.startsAt !== startIso ? crypto.randomUUID() : state.ids.holdKey;
    const loc = state.location;
    const res = await createHoldAction({
      idempotencyKey: key,
      sessionId: state.ids.sessionId,
      selection: selectionOf(state),
      vehicle: { year: state.vehicle.year, make: state.vehicle.make, model: state.vehicle.model, color: state.vehicle.color },
      location:
        loc.locationType === "mobile" && !state.quoteToken
          ? {
              locationType: "mobile",
              address: { ...loc.address, line2: loc.address.line2 || undefined, country: "US" },
              accessNotes: loc.accessNotes || undefined,
              hasWater: loc.hasWater,
              hasPower: loc.hasPower,
            }
          : { locationType: "shop" },
      slotStart: startIso,
      quoteToken: state.quoteToken,
      attribution: getAttribution(),
    });
    setHolding(false);
    if (res.ok && "token" in res) {
      dispatch({
        type: "hold",
        newKey: key,
        hold: {
          token: res.token,
          number: res.number,
          holdExpiresAt: toLocalClock(res.holdExpiresAt, res.serverNow),
          startsAt: res.startsAt,
          endsAt: res.endsAt,
          price: priceSummary(res.price),
          extensions: 0,
          contactSaved: false,
          signature,
        },
      });
      statusRef.current?.focus();
      return;
    }
    const fail = res as { code: string; message: string; alternatives?: SlotData[] };
    if (fail.code === "SLOT_TAKEN" || fail.code === "SLOT_UNAVAILABLE") {
      setError(fail.message);
      setAlternatives(fail.alternatives ?? []);
      dispatch({ type: "hold", hold: null, newKey: crypto.randomUUID() });
      void load();
    } else if (fail.code === "QUOTE_ROUTE" || fail.code === "OUT_OF_AREA") {
      setLoadError({ ok: false, code: fail.code, message: fail.message });
    } else setError(fail.message ?? "Something went wrong. Please try again.");
  };

  const disabledDay = (d: Date) => !byDate.has(ymd(d, tz));

  return (
    <StepShell
      title="Pick a date and time"
      intro={avail ? `Times shown in ${avail.zoneLabel}. Your job takes about ${formatDuration(avail.durationMin)}.` : undefined}
      onBack={onBack}
      error={error}
      nextDisabled={!state.hold}
      pending={holding}
      onNext={() => {
        if (!state.hold) return setError("Choose a time to continue.");
        onNext();
      }}
    >
      {loadError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-5">
          <p className="font-semibold">{loadError.message}</p>
          {(loadError.code === "OUT_OF_AREA" || loadError.code === "QUOTE_ROUTE") && (
            <Button type="button" className="w-fit" onClick={onSwitchToQuote}>
              Request a quote instead
            </Button>
          )}
          {loadError.code === "NETWORK" && (
            <Button type="button" variant="secondary" className="w-fit" onClick={() => void load()}>
              Try again
            </Button>
          )}
        </div>
      ) : (
        // Calendar beside the times, except at lg where the summary sidebar leaves too little room.
        <div className="grid gap-8 md:grid-cols-[auto_1fr] lg:grid-cols-1 xl:grid-cols-[auto_1fr]">
          <div aria-busy={loading} className="rounded-2xl border border-white/10 bg-ink-850 p-3 [--rdp-accent-color:var(--brand)] [--rdp-accent-background-color:rgb(200_162_74/0.15)] [--rdp-day-height:44px] [--rdp-day-width:44px] [--rdp-day_button-height:42px] [--rdp-day_button-width:42px]">
            <DayPicker
              mode="single"
              timeZone={tz}
              selected={selectedDate ? new Date(`${selectedDate}T12:00:00`) : undefined}
              onSelect={(d) => d && setSelectedDate(ymd(d, tz))}
              disabled={disabledDay}
              startMonth={avail ? new Date(`${avail.firstBookableDate}T12:00:00`) : undefined}
              endMonth={avail ? new Date(`${avail.lastBookableDate}T12:00:00`) : undefined}
              onMonthChange={(m) => setFromDate(ymd(m, tz))}
              aria-label="Choose a date"
            />
          </div>
          <div className="flex flex-col gap-4">
            {loading && <p className="text-fg-muted" role="status">Loading available times…</p>}
            {!loading && avail && avail.days.length === 0 && (
              <div className="flex flex-col gap-3 rounded-2xl bg-ink-850 p-5">
                <p className="flex items-center gap-2 font-semibold">
                  <CalendarX className="size-5 text-warning" aria-hidden="true" /> No times available in this period.
                </p>
                <p className="text-sm text-fg-muted">Try the next month, or call {data.phoneDisplay} and we'll find a time.</p>
              </div>
            )}
            {selectedDate && slots.length > 0 && (
              <fieldset>
                <legend className="mb-3 font-semibold">{formatDateLong(Date.parse(`${selectedDate}T12:00:00Z`), "UTC")}</legend>
                <RadioCards
                  label="Available times"
                  columns={3}
                  value={state.hold?.startsAt ?? null}
                  onValueChange={(v) => void hold(v)}
                  options={slots.map((s) => ({
                    value: s.start,
                    title: <span className="whitespace-nowrap">{s.label}</span>,
                    disabled: holding,
                  }))}
                />
              </fieldset>
            )}
            {alternatives.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Closest open times</p>
                <div className="flex flex-wrap gap-2">
                  {alternatives.map((s) => (
                    <Button key={s.start} type="button" variant="secondary" size="sm" onClick={() => void hold(s.start)}>
                      {formatDateLong(Date.parse(s.start), tz).split(",").slice(0, 2).join(",")} · {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <p ref={statusRef} tabIndex={-1} role="status" className="text-sm text-success outline-none">
              {state.hold ? `Held for you: ${formatDateLong(Date.parse(state.hold.startsAt), tz)}.` : ""}
            </p>
          </div>
        </div>
      )}
    </StepShell>
  );
}
