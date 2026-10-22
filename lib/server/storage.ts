/**
 * Private object storage for quote photos (docs/PLAN.md §9).
 * - r2: Cloudflare R2 via the S3 API. Presigned PUT with the exact Content-Type and
 *   Content-Length signed in (R2 doesn't document POST-policy uploads), then a HEAD +
 *   16-byte ranged GET verifies size and magic bytes.
 * - local: dev/test only; files under .uploads/, PUT through /api/uploads/local with an HMAC.
 */
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env, siteUrl, storageMode } from "@/lib/env";

export const UPLOAD_LIMITS = {
  maxFiles: 10,
  maxBytes: 15 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const,
};
export type UploadType = (typeof UPLOAD_LIMITS.types)[number];

const LOCAL_ROOT = path.resolve(process.cwd(), ".uploads");

let s3: S3Client | undefined;
function client() {
  const e = env();
  s3 ??= new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT,
    credentials: { accessKeyId: e.S3_ACCESS_KEY_ID ?? "", secretAccessKey: e.S3_SECRET_ACCESS_KEY ?? "" },
    forcePathStyle: true,
  });
  return s3;
}

function localSig(key: string, contentType: string, size: number, exp: number) {
  return createHmac("sha256", `local-upload:${env().TOKEN_PEPPER}`).update(`${key}|${contentType}|${size}|${exp}`).digest("hex");
}

export function verifyLocalSignature(key: string, contentType: string, size: number, exp: number, sig: string, nowMs: number) {
  if (exp < nowMs) return false;
  const expected = Buffer.from(localSig(key, contentType, size, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function localPath(key: string) {
  const p = path.resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("bad key");
  return p;
}

export async function presignUpload(key: string, contentType: UploadType, size: number, nowMs: number) {
  const mode = storageMode();
  if (mode === "none") throw new Error("Storage is not configured");
  if (mode === "local") {
    const exp = nowMs + 10 * 60_000;
    const qs = new URLSearchParams({ key, type: contentType, size: String(size), exp: String(exp), sig: localSig(key, contentType, size, exp) });
    return { url: `${siteUrl()}/api/uploads/local?${qs}`, headers: { "Content-Type": contentType } };
  }
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 600, signableHeaders: new Set(["content-type", "content-length"]) },
  );
  return { url, headers: { "Content-Type": contentType } };
}

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  "image/heic": (b) => b.subarray(4, 8).toString("ascii") === "ftyp",
  "image/heif": (b) => b.subarray(4, 8).toString("ascii") === "ftyp",
};

export function magicMatches(contentType: string, head: Buffer) {
  return MAGIC[contentType]?.(head) ?? false;
}

/** Confirms an uploaded object exists, matches the declared size and is really an image. */
export async function verifyUpload(key: string, contentType: string, size: number): Promise<boolean> {
  const mode = storageMode();
  if (mode === "local") {
    try {
      const file = await fs.readFile(localPath(key));
      return file.length === size && magicMatches(contentType, file.subarray(0, 16));
    } catch {
      return false;
    }
  }
  if (mode !== "r2") return false;
  const head = await client().send(new HeadObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
  if (head.ContentLength !== size) return false;
  const obj = await client().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key, Range: "bytes=0-15" }));
  const bytes = Buffer.from((await obj.Body?.transformToByteArray()) ?? []);
  return magicMatches(contentType, bytes);
}

/** Short-lived URL for the admin to view a private photo. */
export async function signedViewUrl(key: string): Promise<string> {
  const mode = storageMode();
  if (mode === "local") {
    const exp = Date.now() + 10 * 60_000;
    const sig = localSig(key, "view", 0, exp);
    return `/api/uploads/local?${new URLSearchParams({ key, view: "1", exp: String(exp), sig })}`;
  }
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }), { expiresIn: 600 });
}

export function verifyViewSignature(key: string, exp: number, sig: string, nowMs: number) {
  return verifyLocalSignature(key, "view", 0, exp, sig, nowMs);
}

export async function writeLocal(key: string, data: Buffer) {
  const p = localPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
}

export async function readLocal(key: string) {
  return fs.readFile(localPath(key));
}
