"use client";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { confirmUploadAction, signUploadAction } from "@/app/(flow)/book/actions";
import { Button } from "@/components/ui/button";
import { compressImage, putWithProgress } from "@/lib/booking/compress";

const MAX = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

interface Item {
  key: string;
  name: string;
  preview: string | null;
  status: "compressing" | "uploading" | "done" | "error";
  progress: number;
  photoId?: string;
  error?: string;
  file: File;
}

export function PhotoUploader({ uploadSessionId, photoIds, onChange }: { uploadSessionId: string; photoIds: string[]; onChange: (ids: string[]) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const idsRef = useRef(photoIds);
  idsRef.current = photoIds;

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const upload = async (item: Item) => {
    try {
      update(item.key, { status: "compressing", progress: 0, error: undefined });
      const { blob, type } = await compressImage(item.file);
      const signed = await signUploadAction({ uploadSessionId, contentType: type, size: blob.size });
      if (!signed.ok || !("url" in signed)) throw new Error(("message" in signed && signed.message) || "Upload unavailable");
      update(item.key, { status: "uploading" });
      await putWithProgress(signed.url, blob, signed.headers, (p) => update(item.key, { progress: p }));
      const confirmed = await confirmUploadAction({ uploadSessionId, photoId: signed.photoId });
      if (!confirmed.ok) throw new Error("That file doesn't look like a photo.");
      update(item.key, { status: "done", progress: 100, photoId: signed.photoId });
      onChange([...idsRef.current, signed.photoId]);
    } catch (err) {
      update(item.key, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const room = MAX - items.filter((i) => i.status !== "error").length;
    const picked = [...files].slice(0, Math.max(0, room));
    setMessage(files.length > picked.length ? `You can upload up to ${MAX} photos — ${files.length - picked.length} weren't added.` : null);
    const created: Item[] = picked.map((file) => ({
      key: crypto.randomUUID(),
      name: file.name,
      preview: file.type.includes("heic") ? null : URL.createObjectURL(file),
      status: "compressing",
      progress: 0,
      file,
    }));
    setItems((list) => [...list, ...created]);
    created.forEach((c) => void upload(c));
    if (input.current) input.current.value = "";
  };

  const remove = (item: Item) => {
    setItems((list) => list.filter((i) => i.key !== item.key));
    if (item.photoId) onChange(idsRef.current.filter((p) => p !== item.photoId));
  };

  const full = items.filter((i) => i.status !== "error").length >= MAX;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <input
          ref={input}
          id={id}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          disabled={full}
          onChange={(e) => onFiles(e.target.files)}
        />
        <label
          htmlFor={id}
          className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-ink-850 p-6 text-center hover:border-gold-400 has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-300"
        >
          <ImagePlus className="size-7 text-gold-300" aria-hidden="true" />
          <span className="font-semibold">{full ? "Photo limit reached" : "Add photos"}</span>
          <span className="text-sm text-fg-muted">Up to {MAX} photos · JPG, PNG, WebP or HEIC · we resize them for you</span>
        </label>
      </div>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Selected photos">
          {items.map((i) => (
            <li key={i.key} className="relative overflow-hidden rounded-xl border border-white/10 bg-ink-850">
              <div className="aspect-square bg-ink-800">
                {i.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.preview} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="flex flex-col gap-1.5 p-2 text-xs">
                <span className="truncate" title={i.name}>{i.name}</span>
                {i.status !== "done" && i.status !== "error" && (
                  <div role="progressbar" aria-label={`Uploading ${i.name}`} aria-valuenow={i.progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full origin-left bg-gold-400 transition-transform" style={{ transform: `scaleX(${i.progress / 100})` }} />
                  </div>
                )}
                {i.status === "done" && <span className="text-success">Uploaded</span>}
                {i.status === "error" && (
                  <span className="flex items-center justify-between gap-2 text-danger">
                    {i.error}
                    <Button type="button" variant="ghost" size="icon" onClick={() => void upload(i)} aria-label={`Retry ${i.name}`}>
                      <RotateCcw aria-hidden="true" />
                    </Button>
                  </span>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} className="absolute top-1 right-1 bg-ink-900/70" aria-label={`Remove ${i.name}`}>
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
