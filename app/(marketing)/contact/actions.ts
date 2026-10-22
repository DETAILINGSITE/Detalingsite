"use server";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { verifyCaptcha } from "@/lib/server/captcha";
import { now } from "@/lib/server/clock";
import { flushOutbox } from "@/lib/server/jobs";
import { createLead } from "@/lib/server/leads";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { ContactFormSchema, ExitOfferSchema } from "@/lib/validation/actions";

export async function submitContactAction(raw: unknown) {
  const parsed = ContactFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, message: "Please check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }
  if (parsed.data.website) return { ok: true as const }; // honeypot: pretend success
  const ip = await clientIp();
  const rl = await rateLimit(getDb(), "form", ip, now());
  if (!rl.ok) return { ok: false as const, message: "Too many messages — please call us instead." };
  const captcha = await verifyCaptcha(parsed.data.captchaToken, { ip, action: "contact" });
  if (!captcha.ok) return { ok: false as const, message: "Please complete the security check and try again." };
  const d = parsed.data;
  await createLead(
    { submissionId: d.submissionId, source: "contact_form", name: d.name, email: d.email, phoneE164: d.phone ?? null, message: d.message, attribution: d.attribution },
    new Date(now()),
  );
  after(() => flushOutbox().catch((e) => console.error(e)));
  return { ok: true as const };
}

export async function submitExitOfferAction(raw: unknown) {
  const parsed = ExitOfferSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Enter a valid email address." };
  const ip = await clientIp();
  const rl = await rateLimit(getDb(), "form", ip, now());
  if (!rl.ok) return { ok: false as const, message: "Please try again later." };
  await createLead(
    { submissionId: parsed.data.submissionId, source: "exit_offer", email: parsed.data.email, message: "Requested the first-detail discount.", attribution: parsed.data.attribution },
    new Date(now()),
  );
  after(() => flushOutbox().catch((e) => console.error(e)));
  return { ok: true as const };
}
