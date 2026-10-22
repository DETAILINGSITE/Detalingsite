"use client";
import { useState } from "react";
import { RadioCards } from "@/components/ui/radio-cards";
import { StepShell } from "../step-shell";
import type { StepProps } from "./types";

export function PathStep({ state, dispatch, onNext }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  return (
    <StepShell
      title="What can we help with?"
      intro="Book a service online, or describe a custom job and we'll send you a price."
      error={error}
      onNext={() => {
        if (!state.path) return setError("Choose one option to continue.");
        onNext();
      }}
    >
      <RadioCards
        label="Booking type"
        value={state.path}
        onValueChange={(v) => {
          setError(null);
          dispatch({ type: "setPath", path: v as "service" | "custom" });
        }}
        options={[
          {
            value: "service",
            title: "Choose a service or package",
            description: "See live prices for your vehicle and pick a time that suits you.",
          },
          {
            value: "custom",
            title: "Custom job / get a quote",
            description: "PPF, boats & RVs, fleets, heavy restoration or anything unusual — send photos and we'll quote it.",
          },
        ]}
      />
    </StepShell>
  );
}
