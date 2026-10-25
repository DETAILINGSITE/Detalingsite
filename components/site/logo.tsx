import { business } from "@/config/business";
import { cn } from "@/lib/utils";

/** Wordmark rendered as text (no request, crisp at any size). Swap for an <Image> of the real logo. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7 shrink-0">
        <defs>
          <linearGradient id="logo-g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#cfe6ff" />
            <stop offset="1" stopColor="#1565c0" />
          </linearGradient>
        </defs>
        <path d="M4 20c3-7 8-11 12-11s9 4 12 11" fill="none" stroke="url(#logo-g)" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M9 22h14" stroke="url(#logo-g)" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="22" cy="10" r="1.6" fill="#cfe6ff" />
      </svg>
      <span className="font-display text-[1.02rem] font-bold tracking-tight text-fg">{business.name}</span>
    </span>
  );
}
