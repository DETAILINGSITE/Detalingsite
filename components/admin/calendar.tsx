"use client";
/**
 * Admin resource calendar. Drag a booking onto a 30-minute cell to reschedule
 * (dnd-kit, with keyboard sensor); every booking also has a "Move" dialog as the
 * non-drag alternative (WCAG 2.5.7). Conflicts are rejected by the database.
 */
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, useTransition } from "react";
import { bookingRescheduleAction } from "@/app/admin/(dash)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CalendarColumn {
  key: string;
  label: string;
  resourceId: string | null;
  date: string;
  slots: string[];
}

export interface CalendarItem {
  id: string;
  bookingId: string | null;
  kind: "booking" | "block";
  title: string;
  status: string | null;
  held: boolean;
  resourceId: string;
  date: string;
  startMin: number;
  endMin: number;
  startIso: string;
  color: string;
}

const ROW_PX = 28;

function Cell({ id, label }: { id: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} aria-label={label} className={cn("border-b border-white/[0.04]", isOver && "bg-gold-500/20")} style={{ height: ROW_PX }} />;
}

function Item({ item, top, height, onMove }: { item: CalendarItem; top: number; height: number; onMove: () => void }) {
  const draggable = item.kind === "booking" && item.status === "confirmed";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-xs shadow-lg",
        item.kind === "block" ? "border-white/20 bg-[repeating-linear-gradient(45deg,#2a2f36,#2a2f36_6px,#1d2126_6px,#1d2126_12px)]" : "bg-ink-700",
        item.held && "opacity-60",
        isDragging && "z-20 opacity-80",
      )}
      style={{ top, height: Math.max(height, ROW_PX), borderColor: item.kind === "booking" ? item.color : undefined, transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
    >
      <div className="flex items-start justify-between gap-1">
        {item.bookingId ? (
          <Link href={`/admin/bookings/${item.bookingId}`} className="font-semibold hover:underline">{item.title}</Link>
        ) : (
          <span className="font-semibold">{item.title}</span>
        )}
        {draggable && (
          <span className="flex shrink-0 gap-1">
            <button type="button" {...listeners} {...attributes} aria-label={`Drag ${item.title}`} className="cursor-grab rounded px-1 hover:bg-white/10">⠿</button>
            <button type="button" onClick={onMove} className="rounded px-1 hover:bg-white/10">Move</button>
          </span>
        )}
      </div>
      {item.held && <span className="text-fg-subtle">hold</span>}
    </div>
  );
}

export function AdminCalendar({
  view,
  columns,
  items,
  dayStartMin,
  dayEndMin,
  slotMin,
  resources,
  timeZone,
}: {
  timeZone: string;
  view: "day" | "week";
  columns: CalendarColumn[];
  items: CalendarItem[];
  dayStartMin: number;
  dayEndMin: number;
  slotMin: number;
  resources: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState<CalendarItem | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const rows = (dayEndMin - dayStartMin) / slotMin;

  const move = (item: CalendarItem, startIso: string, resourceId?: string) => {
    if (!item.bookingId) return;
    start(async () => {
      const r = await bookingRescheduleAction({ id: item.bookingId!, startIso, resourceId });
      setMsg(r.ok ? `Moved ${item.title}.` : r.message);
      if (r.ok) router.refresh();
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const item = items.find((i) => i.id === e.active.id);
    const [colKey, idx] = String(e.over.id).split("|");
    const col = columns.find((c) => c.key === colKey);
    const iso = col?.slots[Number(idx)];
    if (!item || !col || !iso || iso === item.startIso) return;
    move(item, iso, col.resourceId ?? undefined);
  };

  return (
    <div className="flex flex-col gap-3">
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-fg-muted">{pending ? "Saving…" : msg}</p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto rounded-2xl border border-white/10" role="region" aria-label="Schedule" tabIndex={0}>
          <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(120px, 1fr))` }}>
            <div className="sticky top-0 border-b border-white/10 bg-ink-800" />
            {columns.map((c) => (
              <div key={c.key} className="border-b border-l border-white/10 bg-ink-800 px-2 py-3 text-center text-sm font-semibold">{c.label}</div>
            ))}
            <div>
              {Array.from({ length: rows }, (_, i) => {
                const m = dayStartMin + i * slotMin;
                return (
                  <div key={i} className="pr-2 text-right text-[0.7rem] text-fg-subtle" style={{ height: ROW_PX }}>
                    {m % 60 === 0 ? `${((Math.floor(m / 60) + 11) % 12) + 1}${m < 720 ? "am" : "pm"}` : ""}
                  </div>
                );
              })}
            </div>
            {columns.map((c) => {
              const colItems = items.filter((it) => it.date === c.date && (view === "week" || it.resourceId === c.resourceId));
              return (
                <div key={c.key} className="relative border-l border-white/10">
                  {c.slots.map((iso, i) => (
                    <Cell key={iso} id={`${c.key}|${i}`} label={`${c.label} ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}`} />
                  ))}
                  {colItems.map((it) => (
                    <Item key={it.id} item={it} top={((it.startMin - dayStartMin) / slotMin) * ROW_PX} height={((it.endMin - it.startMin) / slotMin) * ROW_PX} onMove={() => setMoving(it)} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </DndContext>

      <Dialog.Root open={!!moving} onOpenChange={(o) => !o && setMoving(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[101] w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-ink-850 p-6">
            <Dialog.Title className="text-lg font-bold">Move {moving?.title}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-fg-muted">Pick a new start time. Conflicts are rejected automatically.</Dialog.Description>
            <form
              className="mt-4 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const iso = String(f.get("slot"));
                const res = String(f.get("resource") || "");
                if (moving) move(moving, iso, res || undefined);
                setMoving(null);
              }}
            >
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold">New start</span>
                <select name="slot" className="min-h-11 rounded-xl border border-white/12 bg-ink-800 px-3" defaultValue={moving?.startIso}>
                  {columns.flatMap((c) =>
                    c.slots.map((iso) => (
                      <option key={`${c.key}-${iso}`} value={iso}>
                        {c.label} · {new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold">Crew / bay</span>
                <select name="resource" defaultValue={moving?.resourceId} className="min-h-11 rounded-xl border border-white/12 bg-ink-800 px-3">
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <Button type="submit">Move booking</Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
