import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
// clsx, not cn(): Button ships to the client on every page. Callers only add layout classes
// (width) that never conflict with the variants, so tailwind-merge would be dead weight.
import { clsx } from "clsx";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[0.95rem] font-semibold transition-[transform,opacity,background-color,color,box-shadow] duration-200 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--brand)] text-ink-950 shadow-[0_8px_30px_-10px_var(--brand)] hover:bg-gold-300",
        secondary: "border border-white/15 bg-white/[0.04] text-fg hover:bg-white/[0.09]",
        ghost: "text-fg hover:bg-white/[0.06]",
        link: "min-h-0 px-0 text-gold-300 underline-offset-4 hover:underline",
        danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: {
        sm: "min-h-11 px-4 text-sm",
        md: "",
        lg: "min-h-13 px-7 text-base",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {}

/** For links styled as buttons, use buttonVariants() on the <Link>/<a> directly. */
export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={clsx(buttonVariants({ variant, size }), className)} {...props} />;
}
