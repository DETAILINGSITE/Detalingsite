"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

/** TOTP setup: enable with password → add the key to an authenticator app → verify a code. */
export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(enabled);
  const secret = uri ? (new URL(uri).searchParams.get("secret") ?? "") : "";

  if (done) return <p className="card p-5 text-success">Two-factor authentication is on.</p>;

  return (
    <div className="card flex flex-col gap-5 p-6">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!uri ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const password = String(new FormData(e.currentTarget).get("password"));
            const res = await authClient.twoFactor.enable({ password });
            if (res.error || !res.data || !("totpURI" in res.data)) return setError("Password incorrect.");
            setUri(res.data.totpURI);
            setCodes(res.data.backupCodes);
          }}
        >
          <Field label="Confirm your password" htmlFor="pw" required>
            <Input id="pw" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Button type="submit">Set up authenticator</Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
            const res = await authClient.twoFactor.verifyTotp({ code });
            if (res.error) return setError("That code didn't work.");
            setDone(true);
            router.refresh();
          }}
        >
          <p className="text-sm text-fg-muted">
            In your authenticator app (Google Authenticator, 1Password, Authy…), add an account with this setup key:
          </p>
          <code className="rounded-xl bg-ink-950 p-3 font-mono text-sm break-all select-all">{secret}</code>
          <a href={uri} className="text-sm text-gold-300 underline">Or open the setup link on this device</a>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Backup codes (store them safely)</summary>
            <ul className="mt-2 grid grid-cols-2 gap-1 font-mono">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
          <Field label="Enter the 6-digit code to finish" htmlFor="code" required>
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
          </Field>
          <Button type="submit">Turn on 2FA</Button>
        </form>
      )}
    </div>
  );
}
