import { business } from "@/config/business";
import { cn } from "@/lib/utils";

/** Stand-in MJ-and-crown mark drawn from the flyer, plus a text wordmark. Swap for an <Image> of the real logo. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg aria-hidden="true" viewBox="0 0 40 32" className="h-7 w-auto shrink-0">
        <defs>
          <linearGradient id="logo-g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#cfe6ff" />
            <stop offset="1" stopColor="#2b8cff" />
          </linearGradient>
        </defs>
        <path d="M13 9.5 12.6 3l4.6 3L20 1.5 22.8 6l4.6-3-.4 6.5Z" fill="url(#logo-g)" />
        <path d="M3 29 7.2 13l6.3 11L20 13l-2.4 16" fill="none" stroke="url(#logo-g)" strokeWidth="3.2" strokeLinejoin="miter" />
        <path d="M33 13 30.2 25c-.8 3.2-3.4 4.4-7.2 3.2" fill="none" stroke="url(#logo-g)" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[1.02rem] font-bold tracking-tight whitespace-nowrap text-fg">{business.name}</span>
    </span>
  );
}
