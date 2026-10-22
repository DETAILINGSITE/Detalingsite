import { paymentsMode } from "@/lib/env";
import { fakeDriver } from "./fake";
import { stripeDriver } from "./stripe";
import type { PaymentDriver } from "./types";

export function paymentDriver(): PaymentDriver | null {
  const mode = paymentsMode();
  if (mode === "fake") return fakeDriver;
  if (mode === "stripe") return stripeDriver;
  return null;
}

export type { PaymentDriver } from "./types";
