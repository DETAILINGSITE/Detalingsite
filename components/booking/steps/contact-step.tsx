"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { attachContactAction } from "@/app/(flow)/book/actions";
import { Turnstile } from "@/components/forms/turnstile";
import { Checkbox, Field, Input, Select, describedBy, useFieldIds } from "@/components/ui/field";
import { RadioCards } from "@/components/ui/radio-cards";
import { ContactSchema, HEARD_ABOUT, HEARD_ABOUT_LABELS, type ContactData, type ContactInput } from "@/lib/validation/booking";
import { StepShell } from "../step-shell";
import type { StepProps } from "./types";

/** Used by both the booking path (attaches to the hold) and the quote path (submitted later). */
export function ContactStep({
  state,
  dispatch,
  data,
  onNext,
  onBack,
  mode,
  onSubmitQuote,
}: StepProps & { mode: "booking" | "quote"; onSubmitQuote?: (contact: ContactData, captchaToken: string | null) => Promise<string | null> }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const ids = { name: useFieldIds("name"), phone: useFieldIds("phone"), email: useFieldIds("email"), heard: useFieldIds("heard") };
  const form = useForm<ContactInput, unknown, ContactData>({
    resolver: zodResolver(ContactSchema),
    defaultValues: {
      name: state.contact.name,
      phone: state.contact.phone,
      email: state.contact.email,
      preferredContact: state.contact.preferredContact,
      smsConsent: state.contact.smsConsent,
      leadConsent: state.contact.leadConsent,
      heardAbout: (state.contact.heardAbout || undefined) as ContactInput["heardAbout"],
      website: "",
    },
    mode: "onTouched",
    shouldFocusError: true,
  });
  const { register, handleSubmit, control, formState } = form;
  const errs = formState.errors;

  const submit = handleSubmit(async (contact) => {
    setServerError(null);
    dispatch({
      type: "contact",
      patch: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        preferredContact: contact.preferredContact,
        smsConsent: contact.smsConsent,
        leadConsent: contact.leadConsent,
        heardAbout: contact.heardAbout ?? "",
      },
    });
    if (mode === "quote") {
      const err = await onSubmitQuote?.(contact, captcha);
      if (err) {
        setServerError(err);
        setCaptchaReset((n) => n + 1);
      }
      return;
    }
    if (!state.hold) return setServerError("Your time hold expired. Please choose a time again.");
    const res = await attachContactAction({ token: state.hold.token, sessionId: state.ids.sessionId, contact, captchaToken: captcha ?? undefined });
    if (!res.ok) {
      setServerError(res.message ?? "Please check your details.");
      setCaptchaReset((n) => n + 1);
      return;
    }
    dispatch({ type: "hold", hold: { ...state.hold, contactSaved: true } });
    onNext();
  });

  const consentText = data.smsConsentText.replace("{business}", data.businessName);

  return (
    <StepShell
      title="Your contact details"
      intro="We'll send your confirmation and reminders here."
      onBack={onBack}
      onNext={() => void submit()}
      pending={formState.isSubmitting}
      error={serverError}
      nextLabel={mode === "quote" ? "Send quote request" : "Continue to review"}
    >
      <Field label="Full name" htmlFor={ids.name.inputId} error={errs.name?.message} errId={ids.name.errId} required>
        <Input id={ids.name.inputId} autoComplete="name" {...register("name")} aria-invalid={!!errs.name || undefined} aria-describedby={describedBy(ids.name, false, !!errs.name)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Mobile phone" htmlFor={ids.phone.inputId} error={errs.phone?.message} errId={ids.phone.errId} required>
          <Input id={ids.phone.inputId} type="tel" autoComplete="tel" inputMode="tel" {...register("phone")} aria-invalid={!!errs.phone || undefined} aria-describedby={describedBy(ids.phone, false, !!errs.phone)} />
        </Field>
        <Field label="Email" htmlFor={ids.email.inputId} error={errs.email?.message} errId={ids.email.errId} required>
          <Input id={ids.email.inputId} type="email" autoComplete="email" {...register("email")} aria-invalid={!!errs.email || undefined} aria-describedby={describedBy(ids.email, false, !!errs.email)} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Best way to reach you</legend>
        <Controller
          control={control}
          name="preferredContact"
          render={({ field }) => (
            <RadioCards
              label="Preferred contact method"
              columns={3}
              value={field.value}
              onValueChange={field.onChange}
              options={[
                { value: "email", title: "Email" },
                { value: "sms", title: "Text" },
                { value: "call", title: "Phone call" },
              ]}
            />
          )}
        />
      </fieldset>
      <div className="flex flex-col gap-4">
        {data.smsAvailable && (
          <Controller
            control={control}
            name="smsConsent"
            render={({ field }) => (
              <Checkbox id="sms-consent" checked={field.value} onCheckedChange={field.onChange} label="Text me confirmations and reminders" description={<>{consentText} <Link href="/privacy" className="text-gold-300 underline">Privacy policy</Link></>} />
            )}
          />
        )}
        {mode === "booking" && (
          <Controller
            control={control}
            name="leadConsent"
            render={({ field }) => (
              <Checkbox id="lead-consent" checked={field.value} onCheckedChange={field.onChange} label="It's OK to contact me about this booking if I don't finish it" description="We'll only use this to help you complete this booking." />
            )}
          />
        )}
      </div>
      <Field label="How did you hear about us?" htmlFor={ids.heard.inputId}>
        <Select id={ids.heard.inputId} {...register("heardAbout", { setValueAs: (v) => (v === "" ? undefined : v) })}>
          <option value="">Choose one</option>
          {HEARD_ABOUT.map((h) => (
            <option key={h} value={h}>
              {HEARD_ABOUT_LABELS[h]}
            </option>
          ))}
        </Select>
      </Field>
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website <input tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>
      <Turnstile action={mode === "quote" ? "quote_request" : "booking_contact"} onToken={setCaptcha} resetKey={captchaReset} />
    </StepShell>
  );
}
