/**
 * Signed customer tokens (docs/PLAN.md §9).
 *
 * token = base64url(HMAC-SHA256(pepper, "<purpose>:<id>:<version>"))
 *
 * Only SHA-256(token) is stored (indexed for lookup). The server can re-derive a
 * token from (id, version) to put links in reminders without storing it; bumping the
 * version revokes every earlier link.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";

export type TokenPurpose = "manage" | "quote";

export function deriveToken(pepper: string, purpose: TokenPurpose, id: string, version: number): string {
  return createHmac("sha256", pepper).update(`${purpose}:${id}:${version}`).digest("base64url");
}

export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** Cheap shape check before touching the database (43-char base64url). */
export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function newId(): string {
  return randomUUID();
}
