/**
 * Cloudflare Turnstile verification. In dev/test (CAPTCHA_DRIVER=test) the tokens
 * "test-pass" / "test-fail" are accepted/rejected deterministically.
 */
import { captchaMode, env, siteUrl } from "@/lib/env";

export const TEST_PASS_TOKEN = "test-pass";

export async function verifyCaptcha(
  token: string | undefined | null,
  opts: { ip?: string | null; action: string },
): Promise<{ ok: boolean; reason?: string }> {
  const mode = captchaMode();
  if (mode === "none") {
    // Production without Turnstile keys: launch-check fails; at runtime we rely on
    // rate limiting + honeypot rather than locking customers out.
    console.warn("[captcha] TURNSTILE_SECRET_KEY missing — skipping verification");
    return { ok: true, reason: "not_configured" };
  }
  if (!token) return { ok: false, reason: "missing" };
  if (mode === "test") return token === TEST_PASS_TOKEN ? { ok: true } : { ok: false, reason: "test_fail" };

  const body = new URLSearchParams({ secret: env().TURNSTILE_SECRET_KEY ?? "", response: token });
  if (opts.ip) body.set("remoteip", opts.ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success: boolean; hostname?: string; action?: string; "error-codes"?: string[] };
    if (!data.success) return { ok: false, reason: data["error-codes"]?.join(",") ?? "failed" };
    const expectedHost = new URL(siteUrl()).hostname;
    if (data.hostname && data.hostname !== expectedHost && expectedHost !== "localhost")
      return { ok: false, reason: "hostname_mismatch" };
    if (data.action && data.action !== opts.action) return { ok: false, reason: "action_mismatch" };
    return { ok: true };
  } catch (err) {
    console.error("[captcha] verification request failed", err);
    return { ok: false, reason: "network" };
  }
}
