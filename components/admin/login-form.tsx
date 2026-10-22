"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

/** Password managers and paste work (WCAG 3.3.8). TOTP second step when 2FA is on. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"password" | "2fa">(params.get("step") === "2fa" ? "2fa" : "password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await authClient.signIn.email({ email: String(fd.get("email")), password: String(fd.get("password")) });
    setBusy(false);
    if (res.error) return setError("Email or password is incorrect.");
    if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return setStep("2fa");
    router.push("/admin");
    router.refresh();
  };

  const verify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await authClient.twoFactor.verifyTotp({ code: String(fd.get("code")).replace(/\s/g, ""), trustDevice: false });
    setBusy(false);
    if (res.error) return setError("That code didn't work. Try the next one.");
    router.push("/admin");
    router.refresh();
  };

  return step === "password" ? (
    <form onSubmit={signIn} className="mt-6 flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  ) : (
    <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Field label="6-digit code from your authenticator app" htmlFor="code" required>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required />
      </Field>
      <Button type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify"}</Button>
    </form>
  );
}
