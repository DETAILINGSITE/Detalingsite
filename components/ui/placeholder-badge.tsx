import { clsx as cn } from "clsx";

/**
 * Visible marker on placeholder content (sample reviews, stats, photos) so nothing
 * fake can be mistaken for real. `pnpm launch-check` fails while any remain.
 */
export function PlaceholderBadge({ className, label = "Sample — replace before launch" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-placeholder/50 bg-placeholder/10 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-placeholder uppercase",
        className,
      )}
      data-placeholder="true"
    >
      {label}
    </span>
  );
}
