import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP (behind Vercel/proxies the first X-Forwarded-For hop). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/** Reject cross-site POSTs to route handlers (Server Actions have this built in). */
export function sameOrigin(req: Request, siteUrl: string): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const site = new URL(siteUrl);
    const self = new URL(req.url);
    return o.host === site.host || o.host === self.host;
  } catch {
    return false;
  }
}
