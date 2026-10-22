/** Test-only: patch operational settings (e.g. disable the deposit for scenario 16). */
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { OperationalSettingsSchema } from "@/lib/domain/settings";
import { notFound, testEndpointsEnabled } from "@/lib/server/test-mode";

export async function POST(request: Request) {
  if (!testEndpointsEnabled()) return notFound();
  const patch = (await request.json()) as Record<string, unknown>;
  const [row] = await getDb().select().from(s.settings).where(eq(s.settings.id, 1));
  const next = OperationalSettingsSchema.parse({ ...(row?.data ?? {}), ...patch });
  await getDb().update(s.settings).set({ data: next }).where(eq(s.settings.id, 1));
  revalidateTag("settings", "max");
  revalidateTag("catalog", "max");
  return Response.json({ ok: true, settings: next });
}
