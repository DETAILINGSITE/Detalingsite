import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section heading: pill eyebrow, a wide display title with an optional italic-serif accent
 * line, and an intro. Lines mask-reveal on scroll (data-split).
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  intro,
  align = "left",
  as: Tag = "h2",
  id,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  /** Optional second phrase set in the italic serif, e.g. title "Simple packages." accent "Honest prices." */
  accent?: string;
  intro?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-4xl flex-col gap-6", align === "center" && "mx-auto items-center text-center", className)}>
      {eyebrow && (
        <p className="eyebrow" data-reveal="fade">
          {eyebrow}
        </p>
      )}
      <Tag id={id} data-split className="text-[clamp(2.3rem,5.4vw,4.6rem)] leading-[0.96] font-bold tracking-[-0.035em] text-fg">
        {title}
        {accent && (
          <>
            {" "}
            <span className="serif electric pr-[0.06em] text-[1.06em] font-normal">{accent}</span>
          </>
        )}
      </Tag>
      {intro && (
        <p data-reveal className="max-w-2xl text-lg leading-relaxed text-fg-muted md:text-xl">
          {intro}
        </p>
      )}
    </div>
  );
}
