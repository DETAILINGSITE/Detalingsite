/** Dev/test stand-in for presigned R2 URLs (STORAGE_DRIVER=local). Disabled otherwise. */
import { storageMode } from "@/lib/env";
import { now } from "@/lib/server/clock";
import { readLocal, verifyLocalSignature, verifyViewSignature, writeLocal } from "@/lib/server/storage";

function params(request: Request) {
  const u = new URL(request.url).searchParams;
  return { key: u.get("key") ?? "", type: u.get("type") ?? "", size: Number(u.get("size") ?? 0), exp: Number(u.get("exp") ?? 0), sig: u.get("sig") ?? "" };
}

export async function PUT(request: Request) {
  if (storageMode() !== "local") return new Response("Not found", { status: 404 });
  const p = params(request);
  if (!verifyLocalSignature(p.key, p.type, p.size, p.exp, p.sig, now())) return new Response("Forbidden", { status: 403 });
  if (request.headers.get("content-type") !== p.type) return new Response("Content-Type mismatch", { status: 400 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length !== p.size) return new Response("Size mismatch", { status: 400 });
  await writeLocal(p.key, body);
  return new Response(null, { status: 200 });
}

export async function GET(request: Request) {
  if (storageMode() !== "local") return new Response("Not found", { status: 404 });
  const p = params(request);
  if (!verifyViewSignature(p.key, p.exp, p.sig, now())) return new Response("Forbidden", { status: 403 });
  try {
    const data = await readLocal(p.key);
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
