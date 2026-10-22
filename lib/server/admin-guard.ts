/**
 * Server-side admin authorization. Every admin page, Server Action and route handler
 * calls one of these — the proxy redirect is only a convenience, never the guard.
 */
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { now } from "./clock";
import { auth } from "./auth";

export type AdminRole = "owner" | "staff";

export interface AdminSession {
  userId: string;
  name: string;
  email: string;
  role: AdminRole;
  twoFactorEnabled: boolean;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; twoFactorEnabled?: boolean | null };
  return {
    userId: u.id,
    name: u.name,
    email: u.email,
    role: u.role === "owner" ? "owner" : "staff",
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
  };
}

/** For pages: redirects to login. Owners without 2FA are sent to set it up first. */
export async function requireAdminPage(opts: { role?: AdminRole; allowWithout2fa?: boolean } = {}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "owner" && !session.twoFactorEnabled && !opts.allowWithout2fa && process.env.ADMIN_2FA_OPTIONAL !== "1") {
    redirect("/admin/security?setup=1");
  }
  if (opts.role === "owner" && session.role !== "owner") redirect("/admin?denied=owner");
  return session;
}

export class AdminAuthError extends Error {}

/** For Server Actions / route handlers: throws instead of redirecting. */
export async function requireAdmin(role?: AdminRole): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new AdminAuthError("Not signed in");
  if (role === "owner" && session.role !== "owner") throw new AdminAuthError("Owner access required");
  return session;
}

export async function audit(
  session: AdminSession,
  action: string,
  entity: string,
  entityId: string | null,
  diff: Record<string, unknown> = {},
) {
  await getDb().insert(s.adminAuditLog).values({ userId: session.userId, action, entity, entityId, diff, at: new Date(now()) });
}
