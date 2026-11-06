"use client";
/**
 * Booking wizard (docs/PLAN.md §4.1). State: reducer + sessionStorage. The URL's ?step= is
 * kept in sync with native history.pushState, which Next integrates with useSearchParams (no
 * server round trip), so browser back/forward walk the steps. Steps animate with React View
 * Transitions typed "step-forward" / "step-back".
 */
import { CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addTransitionType, startTransition, useEffect, useMemo, useReducer, useRef, useState, ViewTransition } from "react";
import { submitQuoteAction } from "@/app/(flow)/book/actions";
import { buttonVariants } from "@/components/ui/button";
import { captureAttribution, funnel, getAttribution, track } from "@/lib/analytics/track";
import { priceSummary } from "@/lib/booking/summary";
import {
  canEnter,
  clearPersisted,
  firstIncomplete,
  initialState,
  loadPersisted,
  nextStep,
  persist,
  prevStep,
  reducer,
  stepsFor,
  type StepId,
  type WizardState,
} from "@/lib/booking/wizard-state";
import type { WizardData, WizardInit } from "@/lib/booking/wizard-types";
import { price } from "@/lib/domain/pricing";
import type { ContactData } from "@/lib/validation/booking";
import { HoldBanner } from "./hold-banner";
import { Progress } from "./progress";
import { PathStep } from "./steps/path-step";
import { VehicleStep } from "./steps/vehicle-step";
import { Summary } from "./summary";

/*
 * Only the entry steps ship with the page: path (/book) and vehicle (/quote starts there, and
 * renders the wizard on the client, so a lazy entry step would show a placeholder, not the form).
 * The later steps bring zod, react-hook-form, the date picker, address autocomplete and the
 * photo uploader, and evaluating all of that up front was one long main-thread task on a phone.
 * They're still server-rendered (a deep link to ?step=schedule renders fully), and
 * preloadSteps() fetches them, plus the zod schemas, on the visitor's first interaction.
 */
const stepModules = {
  services: () => import("./steps/services-step"),
  custom: () => import("./steps/custom-step"),
  location: () => import("./steps/location-step"),
  schedule: () => import("./steps/schedule-step"),
  contact: () => import("./steps/contact-step"),
  review: () => import("./steps/review-step"),
};
const stepLoading = () => <StepPlaceholder />;
const CustomStep = dynamic(() => stepModules.custom().then((m) => m.CustomStep), { loading: stepLoading });
const ServicesStep = dynamic(() => stepModules.services().then((m) => m.ServicesStep), { loading: stepLoading });
const LocationStep = dynamic(() => stepModules.location().then((m) => m.LocationStep), { loading: stepLoading });
const ScheduleStep = dynamic(() => stepModules.schedule().then((m) => m.ScheduleStep), { loading: stepLoading });
const ContactStep = dynamic(() => stepModules.contact().then((m) => m.ContactStep), { loading: stepLoading });
const ReviewStep = dynamic(() => stepModules.review().then((m) => m.ReviewStep), { loading: stepLoading });

function StepPlaceholder() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

let stepsPreloaded = false;
function preloadSteps() {
  if (stepsPreloaded) return;
  stepsPreloaded = true;
  for (const load of [...Object.values(stepModules), () => import("@/lib/validation/booking")]) void load().catch(() => {});
}

const uuid = () => crypto.randomUUID();

/** `makeId` is a no-op during prerender; real ids are minted on mount (see the hydrate effect). */
function fromInit(init: WizardInit, data: WizardData, makeId: () => string = () => ""): WizardState {
  const pkg = init.packageId ? data.packages.find((p) => p.slug === init.packageId || p.id === init.packageId) : null;
  const svcIds = (init.serviceIds ?? [])
    .map((x) => data.services.find((s) => s.slug === x || s.id === x))
    .filter((s): s is WizardData["services"][number] => Boolean(s));
  const quoteOnly = svcIds.some((s) => s.quoteOnly);
  const s = initialState({
    path: quoteOnly ? "custom" : init.path,
    quoteToken: init.quote ? init.quoteToken : null,
    sizeId: init.quote?.sizeId ?? init.sizeId,
    packageId: pkg?.id ?? null,
    serviceIds: svcIds.filter((x) => x.kind === "service").map((x) => x.id),
    zip: init.zip,
    locationType: init.quote?.locationType ?? init.locationType ?? (data.serviceMode !== "both" ? data.serviceMode : null),
    uuid: makeId,
  });
  if (init.quote) {
    s.contact = { ...s.contact, name: init.quote.customer.name, email: init.quote.customer.email, phone: init.quote.customer.phone };
  }
  if ((pkg || svcIds.length) && !quoteOnly) s.path = "service";
  return s;
}

export function BookingWizard({ data, init }: { data: WizardData; init: WizardInit }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlStep = searchParams.get("step") as StepId | null;
  const [ready, setReady] = useState(false);
  const [state, dispatch] = useReducer(reducer, null, () => fromInit(init, data));
  const [notice, setNotice] = useState<string | null>(init.quoteError ?? null);
  const lastStep = useRef<StepId | null>(null);

  // Fetch the remaining steps once the visitor starts interacting, so moving on is instant.
  useEffect(() => {
    const EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    const go = () => {
      for (const e of EVENTS) window.removeEventListener(e, go);
      preloadSteps();
    };
    for (const e of EVENTS) window.addEventListener(e, go, { passive: true, once: true });
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, go);
    };
  }, []);

  // Hydrate from sessionStorage after mount (server render can't see it).
  useEffect(() => {
    captureAttribution();
    const freshIntent = Boolean(init.packageId || init.serviceIds?.length || init.quoteToken || init.path);
    const saved = loadPersisted();
    const urlStep = new URL(window.location.href).searchParams.get("step") as StepId | null;
    if (saved && !freshIntent && saved.step !== "submitted") {
      let next = saved;
      if (urlStep && canEnter(saved, urlStep)) next = { ...saved, step: urlStep };
      else if (!canEnter(saved, saved.step)) next = { ...saved, step: firstIncomplete(saved) };
      // A lapsed hold can't be resumed on the steps after scheduling.
      if (next.hold && Date.parse(next.hold.holdExpiresAt) <= Date.now()) {
        next = { ...next, hold: null, ids: { ...next.ids, holdKey: uuid() } };
        if (["contact", "review"].includes(next.step)) {
          next.step = "schedule";
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage
          setNotice("Your hold on that time expired. Please choose a time again.");
        }
      }
      dispatch({ type: "reset", state: next });
    } else {
      dispatch({ type: "reset", state: fromInit(init, data, uuid) });
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  useEffect(() => {
    if (ready) persist(state);
  }, [state, ready]);

  // State → URL: every step change becomes a history entry (replace for the first one).
  useEffect(() => {
    if (!ready) return;
    if (urlStep !== state.step) {
      const params = new URLSearchParams(searchParams.toString());
      for (const k of ["pkg", "svc", "size", "zip", "loc", "path"]) params.delete(k);
      params.set("step", state.step);
      const href = `${pathname}?${params}`;
      if (urlStep) window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
    }
    if (lastStep.current !== state.step) {
      funnel("step_view", state.step, getAttribution().utmSource);
      lastStep.current = state.step;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to step changes only
  }, [state.step, ready]);

  // URL → state: browser back/forward. A step that can't be entered yet snaps the URL back.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  });
  // Idempotent: safe to call from both the popstate listener and the useSearchParams effect.
  const followUrl = (step: StepId | null) => {
    const current = stateRef.current;
    if (!readyRef.current || !step || step === current.step) return;
    if (step !== "submitted" && canEnter(current, step)) {
      const order = stepsFor(current);
      const back = order.indexOf(step) < order.indexOf(current.step);
      startTransition(() => {
        addTransitionType(back ? "step-back" : "step-forward");
        dispatch({ type: "goto", step });
      });
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set("step", current.step);
      window.history.replaceState(null, "", url);
    }
  };
  useEffect(() => {
    followUrl(urlStep);
  }, [urlStep, ready]);
  // Rapid back/forward can outrun Next's router transition; read the URL directly as well.
  useEffect(() => {
    const onPop = () => followUrl(new URLSearchParams(window.location.search).get("step") as StepId | null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (step: StepId, direction: "forward" | "back") => {
    if (!canEnter(state, step) && step !== "submitted") return;
    startTransition(() => {
      addTransitionType(direction === "forward" ? "step-forward" : "step-back");
      dispatch({ type: "goto", step });
    });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const goNext = () => {
    funnel("step_complete", state.step);
    const n = nextStep(state);
    if (n) {
      startTransition(() => {
        addTransitionType("step-forward");
        dispatch({ type: "goto", step: n });
      });
      window.scrollTo({ top: 0 });
    }
  };
  const goBack = () => {
    const p = prevStep(state);
    if (p) go(p, "back");
  };

  const switchToQuote = () => {
    track("Switched To Quote");
    dispatch({ type: "patch", patch: { path: "custom", step: "custom", hold: null } });
  };

  const submitQuote = async (contact: ContactData, captchaToken: string | null): Promise<string | null> => {
    const loc = state.location;
    const res = await submitQuoteAction({
      submissionId: state.ids.submissionId,
      sessionId: state.ids.sessionId,
      uploadSessionId: state.custom.uploadSessionId,
      vehicle: { sizeId: state.vehicle.sizeId || null, year: state.vehicle.year, make: state.vehicle.make, model: state.vehicle.model, color: state.vehicle.color },
      job: {
        description: state.custom.description,
        photoIds: state.custom.photoIds,
        preferredDates: state.custom.preferredDates,
        budgetRange: state.custom.budgetRange || undefined,
        serviceIds: state.services.serviceIds,
      },
      location:
        loc.locationType === "mobile"
          ? { locationType: "mobile", address: { ...loc.address, line2: loc.address.line2 || undefined, country: "US" }, accessNotes: loc.accessNotes || undefined, hasWater: loc.hasWater, hasPower: loc.hasPower }
          : { locationType: "shop" },
      contact,
      captchaToken: captchaToken ?? undefined,
      attribution: getAttribution(),
    });
    if (!res.ok) return "message" in res ? (res.message ?? "Please check your details.") : "Please check your details.";
    track("Quote Requested");
    dispatch({ type: "patch", patch: { submittedNumber: "number" in res ? (res.number ?? null) : null, step: "submitted" } });
    clearPersisted();
    return null;
  };

  const onConfirmed = (token: string) => {
    clearPersisted();
    router.push(`/booking/${token}?new=1`);
  };

  // Live preview price before a hold exists; the server's figures replace it afterwards.
  const previewPrice = useMemo(() => {
    if (!state.vehicle.sizeId || state.path !== "service" || state.quoteToken) return null;
    const zone = data.zones.find((z) => z.zipCodes.includes(state.location.address.postalCode.slice(0, 5)));
    const r = price(
      { sizeId: state.vehicle.sizeId, packageId: state.services.packageId, serviceIds: state.services.serviceIds, addonIds: state.services.addonIds, conditionIds: state.vehicle.conditionIds, locationType: state.location.locationType },
      { catalog: data.catalog, ...data.pricing, deposit: data.payments.mode === "none" ? { mode: "none" } : data.pricing.deposit, travelFeeCents: zone?.travelFeeCents ?? 0 },
    );
    return r.lines.length ? priceSummary(r) : null;
  }, [state, data]);

  const summaryProps = {
    depositRefundable: data.depositRefundable,
    when: state.hold?.startsAt ?? null,
    where:
      state.quoteToken && init.quote
        ? init.quote.addressLabel
        : state.location.locationType === "shop"
          ? data.shop.label
          : state.location.address.line1
            ? `${state.location.address.line1}, ${state.location.address.city}`
            : null,
    vehicle: [state.vehicle.year, state.vehicle.make, state.vehicle.model].filter(Boolean).join(" ") || data.sizes.find((z) => z.id === state.vehicle.sizeId)?.label || null,
  };

  // No loading gate: the server and the first client render share the same initial state (ids
  // are minted on mount), so the first step is real HTML for LCP. Saved progress, if any,
  // replaces it right after hydration.

  const steps = stepsFor(state);
  const common = { state, dispatch, data, onNext: goNext, onBack: prevStep(state) ? goBack : undefined };
  const showHold = state.hold && (state.step === "contact" || state.step === "review");

  if (state.step === "submitted") {
    return (
      <div className="container-site max-w-2xl py-16 md:py-24">
        <div role="status" className="card flex flex-col gap-5 p-8">
          <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
          <h1 className="text-3xl font-bold">Request received</h1>
          <p className="text-fg-muted">
            Thanks! We'll review your job and send a price by email{state.contact.smsConsent ? " and text" : ""}, usually within one business day.
            {state.submittedNumber ? <> Your reference is <strong className="text-fg">{state.submittedNumber}</strong>.</> : null}
          </p>
          <Link href="/" className={buttonVariants({ variant: "secondary" }) + " w-fit"}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-site grid gap-10 pt-8 pb-32 md:pt-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-24">
      <div className="flex min-w-0 flex-col gap-8">
        {init.quote && (
          <p className="rounded-2xl border border-gold-400/30 bg-gold-500/[0.07] p-4 text-sm">
            Booking your quoted job <strong>{init.quote.number}</strong>.
          </p>
        )}
        <Progress steps={steps} current={state.step} />
        {showHold && state.hold && (
          <HoldBanner
            token={state.hold.token}
            expiresAt={state.hold.holdExpiresAt}
            canExtend={state.hold.extensions < 1 && state.step === "contact"}
            onExtended={(iso) => state.hold && dispatch({ type: "hold", hold: { ...state.hold, holdExpiresAt: iso, extensions: state.hold.extensions + 1 } })}
            onExpired={() => {
              dispatch({ type: "patch", patch: { hold: null, step: "schedule", ids: { ...state.ids, holdKey: uuid() } } });
              setNotice("Your hold on that time expired. Please choose a time again.");
            }}
          />
        )}
        <ViewTransition key={state.step} enter={{ "step-forward": "step-forward", "step-back": "step-back", default: "none" }} exit={{ "step-forward": "step-forward", "step-back": "step-back", default: "none" }} default="none">
          <div>
            {state.step === "path" && <PathStep {...common} />}
            {state.step === "vehicle" && <VehicleStep {...common} />}
            {state.step === "services" && <ServicesStep {...common} onSwitchToQuote={switchToQuote} />}
            {state.step === "custom" && <CustomStep {...common} />}
            {state.step === "location" && <LocationStep {...common} onSwitchToQuote={switchToQuote} allowOutOfArea={state.path === "custom"} />}
            {state.step === "schedule" && <ScheduleStep {...common} onSwitchToQuote={switchToQuote} notice={notice} />}
            {state.step === "contact" && <ContactStep {...common} mode={state.path === "custom" ? "quote" : "booking"} onSubmitQuote={submitQuote} />}
            {state.step === "review" && <ReviewStep {...common} onConfirmed={onConfirmed} summaryProps={summaryProps} />}
          </div>
        </ViewTransition>
      </div>
      {state.path !== "custom" && <Summary price={state.hold?.price ?? previewPrice} timezone={data.timezone} {...summaryProps} />}
    </div>
  );
}
