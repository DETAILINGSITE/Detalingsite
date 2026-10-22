import { connection } from "next/server";
import type { ReactNode } from "react";

/**
 * All admin routes run under the strict nonce CSP, which needs per-request rendering:
 * a prerendered shell would ship scripts without the nonce. Opt out of the static shell.
 */
export const instant = false;

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  await connection();
  return children;
}
