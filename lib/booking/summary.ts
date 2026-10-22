/** Serializable price summary shared by server responses and the wizard UI. */
import type { PriceLine, PriceNote, PriceResult } from "@/lib/domain/pricing";

export interface PriceSummary {
  lines: PriceLine[];
  notes: string[];
  subtotalCents: number;
  surchargeCents: number;
  travelFeeCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  durationMin: number;
  sizeLabel?: string;
}

export function noteText(n: PriceNote): string {
  return n.code === "auto_added"
    ? `We added ${n.serviceName} because ${n.requiredByName} requires it: ${n.reason}`
    : `${n.serviceName} is already included in the ${n.packageName} package.`;
}

export function priceSummary(p: PriceResult & { sizeLabel?: string; computedAt?: string }): PriceSummary {
  return {
    lines: p.lines,
    notes: p.notes.map(noteText),
    subtotalCents: p.subtotalCents,
    surchargeCents: p.surchargeCents,
    travelFeeCents: p.travelFeeCents,
    discountCents: p.discountCents,
    taxCents: p.taxCents,
    totalCents: p.totalCents,
    depositCents: p.depositCents,
    balanceCents: p.balanceCents,
    durationMin: p.durationMin,
    sizeLabel: p.sizeLabel,
  };
}
