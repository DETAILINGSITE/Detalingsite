import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  as: Tag = "h2",
  id,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-3xl flex-col gap-4", align === "center" && "mx-auto items-center text-center", className)}>
      {eyebrow && (
        <p className="eyebrow" data-reveal="fade">
          {eyebrow}
        </p>
      )}
      <Tag id={id} data-split className="text-[clamp(1.9rem,4.2vw,3.4rem)] leading-[1.02] font-bold text-fg">
        {title}
      </Tag>
      {intro && (
        <p data-reveal className="text-lg leading-relaxed text-fg-muted">
          {intro}
        </p>
      )}
    </div>
  );
}
