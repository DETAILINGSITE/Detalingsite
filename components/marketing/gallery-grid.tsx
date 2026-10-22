"use client";
/** Filterable gallery with an accessible lightbox (Radix Dialog). Images lazy-load below the fold. */
import Image from "next/image";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { PlaceholderBadge } from "@/components/ui/placeholder-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BeforeAfter } from "./before-after";

export interface GalleryItemData {
  id: string;
  title: string;
  vehicle: string | null;
  serviceSlug: string | null;
  serviceName: string | null;
  beforeSrc: string;
  afterSrc: string;
  altBefore: string;
  altAfter: string;
  width: number;
  height: number;
  isPlaceholder: boolean;
}

export function GalleryGrid({ items }: { items: GalleryItemData[] }) {
  const filters = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((i) => i.serviceSlug && i.serviceName && m.set(i.serviceSlug, i.serviceName));
    return [...m.entries()];
  }, [items]);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<GalleryItemData | null>(null);
  const shown = filter === "all" ? items : items.filter((i) => i.serviceSlug === filter);

  return (
    <>
      <div role="group" aria-label="Filter by service" className="flex flex-wrap gap-2">
        {[["all", "All work"] as const, ...filters].map(([slug, name]) => (
          <button
            key={slug}
            type="button"
            aria-pressed={filter === slug}
            onClick={() => setFilter(slug)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
              filter === slug ? "border-gold-400 bg-gold-500/10 text-gold-200" : "border-white/10 text-fg-muted hover:text-fg",
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Showing {shown.length} {shown.length === 1 ? "project" : "projects"}
      </p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpen(item)}
              className="group card block w-full overflow-hidden text-left"
              aria-label={`Open before and after: ${item.title}`}
            >
              <div className="relative overflow-hidden" style={{ aspectRatio: `${item.width} / ${item.height}` }}>
                <Image
                  src={item.afterSrc}
                  alt={item.altAfter}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  loading={i < 3 ? "eager" : "lazy"}
                  unoptimized={item.afterSrc.endsWith(".svg")}
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                {item.isPlaceholder && <PlaceholderBadge className="absolute bottom-3 left-3" label="Sample" />}
              </div>
              <div className="p-4">
                <p className="font-semibold">{item.title}</p>
                {item.vehicle && <p className="text-sm text-fg-muted">{item.vehicle}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <Dialog.Root open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm data-[state=open]:animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[101] w-[min(64rem,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-ink-850 p-4 data-[state=open]:animate-fade-in md:p-6">
            {open && (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-xl font-bold">{open.title}</Dialog.Title>
                    <Dialog.Description className="text-sm text-fg-muted">{open.vehicle ?? "Before and after"}</Dialog.Description>
                  </div>
                  <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Close">
                    <X aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <BeforeAfter before={open.beforeSrc} after={open.afterSrc} altBefore={open.altBefore} altAfter={open.altAfter} width={open.width} height={open.height} isPlaceholder={open.isPlaceholder} />
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
