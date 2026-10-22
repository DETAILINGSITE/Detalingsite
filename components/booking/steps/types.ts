import type { Dispatch } from "react";
import type { Action, WizardState } from "@/lib/booking/wizard-state";
import type { WizardData } from "@/lib/booking/wizard-types";

export interface StepProps {
  state: WizardState;
  dispatch: Dispatch<Action>;
  data: WizardData;
  onNext: () => void;
  onBack?: () => void;
}
