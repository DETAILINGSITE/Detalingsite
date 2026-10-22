/**
 * Client-side image compression (no dependency): decode → downscale to ≤ 2048px →
 * re-encode as WebP (JPEG fallback). Re-encoding also strips EXIF/GPS metadata.
 * Formats the browser can't decode (e.g. HEIC on Chrome) are uploaded as-is.
 */
const MAX_EDGE = 2048;
const TARGET_BYTES = 2 * 1024 * 1024;

export async function compressImage(file: File): Promise<{ blob: Blob; type: string; compressed: boolean }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { blob: file, type: file.type || "image/jpeg", compressed: false };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const encode = async (type: string, quality: number): Promise<Blob | null> => {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
      try {
        return await canvas.convertToBlob({ type, quality });
      } catch {
        return null;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
  };

  for (const type of ["image/webp", "image/jpeg"]) {
    for (const q of [0.85, 0.72, 0.6]) {
      const blob = await encode(type, q);
      if (blob && blob.type === type && blob.size <= TARGET_BYTES) {
        bitmap.close();
        return { blob, type, compressed: true };
      }
    }
  }
  bitmap.close();
  return { blob: file, type: file.type || "image/jpeg", compressed: false };
}

/** PUT with upload progress (fetch can't report upload progress). */
export function putWithProgress(url: string, body: Blob, headers: Record<string, string>, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(body);
  });
}
