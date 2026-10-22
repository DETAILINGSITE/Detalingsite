import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import * as s from "@/db/schema";
import type { Attribution } from "@/lib/validation/booking";
import { enqueueLeadReceived } from "./notify/enqueue";

export async function createLead(
  input: {
    submissionId: string;
    source: "contact_form" | "exit_offer";
    name?: string | null;
    email?: string | null;
    phoneE164?: string | null;
    message?: string | null;
    attribution: Attribution;
  },
  now: Date,
  db: Db = getDb(),
) {
  const [existing] = await db.select().from(s.leads).where(eq(s.leads.submissionId, input.submissionId));
  if (existing) return existing;
  return db.transaction(async (tx) => {
    const [lead] = await tx
      .insert(s.leads)
      .values({
        submissionId: input.submissionId,
        source: input.source,
        name: input.name ?? null,
        email: input.email ?? null,
        phoneE164: input.phoneE164 ?? null,
        message: input.message ?? null,
        consentContactAt: now,
        attribution: input.attribution,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!lead) throw new Error("lead insert failed");
    await enqueueLeadReceived(tx, lead, now);
    return lead;
  });
}
