"use client";
/** "Do you service my area?" — checks ZIP lists locally (no API call). */
import { CheckCircle2, MapPinOff } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/domain/money";

export interface ZoneSummary {
  name: string;
  zipCodes: string[];
  travelFeeCents: number;
  cities: string[];
}

type Result = { kind: "in"; zone: ZoneSummary } | { kind: "out"; zip: string } | null;

export function ZipChecker({ zones, shopEnabled }: { zones: ZoneSummary[]; shopEnabled: boolean }) {
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const id = useId();

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    const z = zip.trim();
    if (!/^\d{5}$/.test(z)) {
      setError("Enter a 5-digit ZIP code.");
      setResult(null);
      return;
    }
    setError(null);
    const zone = zones.find((x) => x.zipCodes.includes(z));
    setResult(zone ? { kind: "in", zone } : { kind: "out", zip: z });
  };

  return (
    <div className="card p-6 md:p-8">
      <form onSubmit={check} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor={`${id}-zip`} className="text-sm font-semibold">
            Your ZIP code
          </label>
          <Input
            id={`${id}-zip`}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            placeholder="e.g. 00010"
          />
        </div>
        <Button type="submit">Check my area</Button>
      </form>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div aria-live="polite" className="mt-5">
        {result?.kind === "in" && (
          <div className="flex animate-fade-in gap-3">
            <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden="true" />
            <div>
              <p className="font-semibold">Good news — we come to you!</p>
              <p className="text-sm text-fg-muted">
                {result.zone.name}
                {result.zone.travelFeeCents > 0 ? ` · travel fee ${formatMoney(result.zone.travelFeeCents)}` : " · no travel fee"}
              </p>
              <Link href={`/book?zip=${zip}`} className={`${buttonVariants({ size: "sm" })} mt-3`}>
                Book a mobile detail
              </Link>
            </div>
          </div>
        )}
        {result?.kind === "out" && (
          <div className="flex animate-fade-in gap-3">
            <MapPinOff className="size-6 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-semibold">{result.zip} is outside our regular area.</p>
              <p className="text-sm text-fg-muted">
                We may still be able to help{shopEnabled ? " — or bring the car to our shop" : ""}. Send us the details and we'll quote it.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/quote?zip=${result.zip}`} className={buttonVariants({ size: "sm" })}>
                  Request a quote
                </Link>
                {shopEnabled && (
                  <Link href="/book?loc=shop" className={buttonVariants({ size: "sm", variant: "secondary" })}>
                    Book in-shop
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
