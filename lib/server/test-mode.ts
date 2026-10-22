import { env, usesTestDrivers } from "@/lib/env";

/** Test-only endpoints exist only when test drivers are on (never on a production deploy). */
export function testEndpointsEnabled(): boolean {
  const e = env();
  if (e.VERCEL_ENV === "production") return false;
  return usesTestDrivers(e) && (e.NODE_ENV !== "production" || e.E2E_TEST_MODE === "1");
}

export const notFound = () => new Response("Not found", { status: 404 });
