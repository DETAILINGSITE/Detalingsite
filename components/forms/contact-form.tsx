"use client";
import { CheckCircle2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { submitContactAction } from "@/app/(marketing)/contact/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, describedBy, useFieldIds } from "@/components/ui/field";
import { getAttribution, track } from "@/lib/analytics/track";
import { Turnstile } from "./turnstile";

type Errors = Partial<Record<"name" | "email" | "phone" | "message", string>>;

export function ContactForm({ defaultTopic }: { defaultTopic?: string }) {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submissionId = useRef<string | null>(null);
  const ids = {
    name: useFieldIds("name"),
    email: useFieldIds("email"),
    phone: useFieldIds("phone"),
    message: useFieldIds("message"),
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    submissionId.current ??= crypto.randomUUID();
    start(async () => {
      const res = await submitContactAction({
        submissionId: submissionId.current!,
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        message: String(fd.get("message") ?? ""),
        website: String(fd.get("website") ?? ""),
        captchaToken: token ?? undefined,
        attribution: getAttribution(),
      });
      if (res.ok) {
        setDone(true);
        track("Contact Submitted");
        return;
      }
      const fe = ("fieldErrors" in res && res.fieldErrors) || {};
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])) as Errors);
      setFormError(res.message);
      const first = Object.keys(fe)[0] as keyof typeof ids | undefined;
      if (first && ids[first]) document.getElementById(ids[first].inputId)?.focus();
    });
  };

  if (done) {
    return (
      <div role="status" className="card flex gap-4 p-8">
        <CheckCircle2 className="size-7 shrink-0 text-success" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">Thanks — message received.</h2>
          <p className="mt-1 text-fg-muted">We'll reply within one business day. Check your inbox for a confirmation.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card flex flex-col gap-5 p-6 md:p-8" aria-describedby={formError ? "contact-form-error" : undefined}>
      {formError && (
        <p id="contact-form-error" role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Field label="Name" htmlFor={ids.name.inputId} error={errors.name} errId={ids.name.errId} required>
        <Input id={ids.name.inputId} name="name" autoComplete="name" required aria-invalid={!!errors.name || undefined} aria-describedby={describedBy(ids.name, false, !!errors.name)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" htmlFor={ids.email.inputId} error={errors.email} errId={ids.email.errId} required>
          <Input id={ids.email.inputId} name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email || undefined} aria-describedby={describedBy(ids.email, false, !!errors.email)} />
        </Field>
        <Field label="Phone" htmlFor={ids.phone.inputId} error={errors.phone} errId={ids.phone.errId}>
          <Input id={ids.phone.inputId} name="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone || undefined} aria-describedby={describedBy(ids.phone, false, !!errors.phone)} />
        </Field>
      </div>
      <Field label="How can we help?" htmlFor={ids.message.inputId} error={errors.message} errId={ids.message.errId} required>
        <Textarea
          id={ids.message.inputId}
          name="message"
          required
          defaultValue={defaultTopic === "membership" ? "I'm interested in a maintenance plan for my car." : undefined}
          aria-invalid={!!errors.message || undefined}
          aria-describedby={describedBy(ids.message, false, !!errors.message)}
        />
      </Field>
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Turnstile action="contact" onToken={setToken} />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-fit">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
