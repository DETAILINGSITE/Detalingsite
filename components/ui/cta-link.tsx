import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";

/**
 * Pill CTA with the arrow nested in its own orb ("button-in-button"). The orb nudges up and
 * right on hover; the whole pill eases toward the cursor when it carries data-magnetic.
 */
export function CtaLink({
  href,
  children,
  variant = "primary",
  size = "lg",
  className,
  magnetic = true,
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "glass";
  size?: "md" | "lg";
  className?: string;
  magnetic?: boolean;
  external?: boolean;
}) {
  const cls = clsx(
    "group inline-flex items-center justify-center gap-3 rounded-full font-semibold whitespace-nowrap select-none",
    "transition-[background-color,box-shadow,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
    size === "lg" ? "min-h-14 pl-7 pr-[1.1rem] text-base" : "min-h-12 pl-6 pr-3.5 text-[0.95rem]",
    variant === "primary"
      ? "bg-[var(--brand)] text-ink-950 shadow-[0_18px_50px_-18px_var(--brand),inset_0_1px_0_rgb(255_255_255/0.35)] hover:bg-gold-300"
      : "border border-white/12 bg-white/[0.04] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-white/[0.08]",
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      <span className={clsx("btn-orb", variant === "glass" && "btn-orb-light")} aria-hidden="true">
        <ArrowUpRight strokeWidth={1.75} className="size-4" />
      </span>
    </>
  );
  // tel:/mailto:/sms: links stay in the same tab; only true external links open a new one.
  if (external || /^(tel|mailto|sms):/.test(href)) {
    return (
      <a href={href} className={cls} data-magnetic={magnetic ? "" : undefined} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} data-magnetic={magnetic ? "" : undefined}>
      {inner}
    </Link>
  );
}
