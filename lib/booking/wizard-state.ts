/**
 * Booking wizard state machine (docs/PLAN.md §4.1). Pure: reducer, step order and
 * guards. The URL carries `?step=` (no PII); the full state lives in sessionStorage
 * so a refresh or the back button never loses progress.
 */
import type { PriceSummary } from "./summary";

export type StepId = "path" | "vehicle" | "services" | "custom" | "location" | "schedule" | "contact" | "review" | "submitted";
export type PathChoice = "service" | "custom";

export const STEP_LABELS: Record<StepId, string> = {
  path: "Start",
  vehicle: "Vehicle",
  services: "Services",
  custom: "Your job",
  location: "Location",
  schedule: "Date & time",
  contact: "Contact",
  review: "Review & pay",
  submitted: "Sent",
};

export interface AddressState {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

export interface HoldState {
  token: string;
  number: string;
  /** On the browser's clock (converted with toLocalClock), so device clock skew can't expire a hold early. */
  holdExpiresAt: string;
  startsAt: string;
  endsAt: string;
  price: PriceSummary;
  extensions: number;
  contactSaved: boolean;
  /** signatureOf() at hold time — if the selection changes, the hold is released and the slot re-checked. */
  signature: string;
}

export interface WizardState {
  v: 1;
  step: StepId;
  path: PathChoice | null;
  quoteToken: string | null;
  vehicle: { sizeId: string; year: string; make: string; model: string; color: string; conditionIds: string[] };
  services: { packageId: string | null; serviceIds: string[]; addonIds: string[] };
  custom: { description: string; photoIds: string[]; preferredDates: string[]; budgetRange: string; uploadSessionId: string };
  location: { locationType: "mobile" | "shop" | null; address: AddressState; accessNotes: string; hasWater: boolean; hasPower: boolean };
  slotStart: string | null;
  hold: HoldState | null;
  contact: {
    name: string;
    phone: string;
    email: string;
    preferredContact: "email" | "sms" | "call";
    smsConsent: boolean;
    leadConsent: boolean;
    heardAbout: string;
  };
  review: { agreePolicy: boolean; promoCode: string };
  ids: { sessionId: string; holdKey: string; submissionId: string };
  submittedNumber: string | null;
}

export function emptyAddress(): AddressState {
  return { line1: "", line2: "", city: "", region: "", postalCode: "" };
}

export function initialState(init: Partial<Pick<WizardState, "path" | "quoteToken">> & {
  sizeId?: string;
  packageId?: string | null;
  serviceIds?: string[];
  zip?: string;
  locationType?: "mobile" | "shop" | null;
  uuid: () => string;
}): WizardState {
  const path = init.quoteToken ? "service" : (init.path ?? null);
  return {
    v: 1,
    step: init.quoteToken ? "schedule" : path ? "vehicle" : "path",
    path,
    quoteToken: init.quoteToken ?? null,
    vehicle: { sizeId: init.sizeId ?? "", year: "", make: "", model: "", color: "", conditionIds: [] },
    services: { packageId: init.packageId ?? null, serviceIds: init.serviceIds ?? [], addonIds: [] },
    custom: { description: "", photoIds: [], preferredDates: [], budgetRange: "", uploadSessionId: init.uuid() },
    location: {
      locationType: init.locationType ?? null,
      address: { ...emptyAddress(), postalCode: init.zip ?? "" },
      accessNotes: "",
      hasWater: true,
      hasPower: true,
    },
    slotStart: null,
    hold: null,
    contact: { name: "", phone: "", email: "", preferredContact: "email", smsConsent: false, leadConsent: false, heardAbout: "" },
    review: { agreePolicy: false, promoCode: "" },
    ids: { sessionId: init.uuid(), holdKey: init.uuid(), submissionId: init.uuid() },
    submittedNumber: null,
  };
}

export function stepsFor(s: Pick<WizardState, "path" | "quoteToken">): StepId[] {
  if (s.quoteToken) return ["schedule", "contact", "review"];
  if (s.path === "custom") return ["path", "vehicle", "custom", "location", "contact", "submitted"];
  return ["path", "vehicle", "services", "location", "schedule", "contact", "review"];
}

/** Lightweight completeness checks used to guard deep links (full Zod validation runs on "Next"). */
export function stepComplete(s: WizardState, step: StepId): boolean {
  switch (step) {
    case "path":
      return s.path !== null;
    case "vehicle":
      return Boolean(s.vehicle.sizeId);
    case "services":
      return s.services.packageId !== null || s.services.serviceIds.length > 0;
    case "custom":
      return s.custom.description.trim().length >= 20;
    case "location":
      return (
        s.location.locationType === "shop" ||
        (s.location.locationType === "mobile" && s.location.address.line1.length > 2 && /^\d{5}/.test(s.location.address.postalCode))
      );
    case "schedule":
      return s.hold !== null && Date.parse(s.hold.holdExpiresAt) > Date.now();
    case "contact":
      return s.hold?.contactSaved === true || (s.path === "custom" && s.contact.email.length > 3);
    case "review":
    case "submitted":
      return false;
  }
}

/** The furthest step the user may be on: the first incomplete step in order. */
export function firstIncomplete(s: WizardState): StepId {
  const steps = stepsFor(s);
  for (const st of steps) if (!stepComplete(s, st)) return st;
  return steps[steps.length - 1]!;
}

export function canEnter(s: WizardState, step: StepId): boolean {
  const steps = stepsFor(s);
  const idx = steps.indexOf(step);
  if (idx === -1) return false;
  return steps.slice(0, idx).every((st) => stepComplete(s, st));
}

export function nextStep(s: WizardState): StepId | null {
  const steps = stepsFor(s);
  const i = steps.indexOf(s.step);
  return steps[i + 1] ?? null;
}

export function prevStep(s: WizardState): StepId | null {
  const steps = stepsFor(s);
  const i = steps.indexOf(s.step);
  return i > 0 ? (steps[i - 1] ?? null) : null;
}

export type Action =
  | { type: "goto"; step: StepId }
  | { type: "setPath"; path: PathChoice }
  | { type: "patch"; patch: Partial<WizardState> }
  | { type: "vehicle"; patch: Partial<WizardState["vehicle"]> }
  | { type: "services"; patch: Partial<WizardState["services"]> }
  | { type: "custom"; patch: Partial<WizardState["custom"]> }
  | { type: "location"; patch: Partial<WizardState["location"]> }
  | { type: "contact"; patch: Partial<WizardState["contact"]> }
  | { type: "review"; patch: Partial<WizardState["review"]> }
  | { type: "hold"; hold: HoldState | null; newKey?: string }
  | { type: "reset"; state: WizardState };

export function reducer(s: WizardState, a: Action): WizardState {
  switch (a.type) {
    case "goto":
      return { ...s, step: a.step };
    case "setPath":
      return { ...s, path: a.path };
    case "patch":
      return { ...s, ...a.patch };
    case "vehicle":
      return { ...s, vehicle: { ...s.vehicle, ...a.patch } };
    case "services":
      return { ...s, services: { ...s.services, ...a.patch } };
    case "custom":
      return { ...s, custom: { ...s.custom, ...a.patch } };
    case "location":
      return { ...s, location: { ...s.location, ...a.patch } };
    case "contact":
      return { ...s, contact: { ...s.contact, ...a.patch } };
    case "review":
      return { ...s, review: { ...s.review, ...a.patch } };
    case "hold":
      return {
        ...s,
        hold: a.hold,
        slotStart: a.hold ? a.hold.startsAt : s.slotStart,
        ids: a.newKey ? { ...s.ids, holdKey: a.newKey } : s.ids,
      };
    case "reset":
      return a.state;
  }
}

// ── Persistence (sessionStorage; never the URL for PII) ──────────────────────
export const STORAGE_KEY = "booking.wizard.v1";

export function loadPersisted(): WizardState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardState;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function persist(s: WizardState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // private mode / quota — the flow still works for this page view
  }
}

export function clearPersisted() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function selectionOf(s: WizardState) {
  return {
    sizeId: s.vehicle.sizeId,
    packageId: s.services.packageId,
    serviceIds: s.services.serviceIds,
    addonIds: s.services.addonIds,
    conditionIds: s.vehicle.conditionIds,
  };
}

/** Everything that affects price/duration/location of the job. */
export function signatureOf(s: WizardState): string {
  return JSON.stringify([selectionOf(s), s.location.locationType, s.location.address.postalCode, s.location.address.lat, s.location.address.lng, s.quoteToken]);
}

/** Re-bases a server timestamp onto the browser clock: same remaining time, local epoch. */
export function toLocalClock(serverIso: string, serverNow: string): string {
  return new Date(Date.now() + (Date.parse(serverIso) - Date.parse(serverNow))).toISOString();
}
