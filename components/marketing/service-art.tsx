import { cn } from "@/lib/utils";

/**
 * Lightweight generated art per service (inline SVG, zero requests) until real photos
 * are added in Admin → Content. Deterministic per slug so it's stable across renders.
 */
const PALETTES: Record<string, [string, string, string]> = {
  exterior: ["#1d2a36", "#3b6b8f", "#9fd0ff"],
  interior: ["#2a221b", "#7a5c3c", "#f0dfae"],
  "paint-protection": ["#1c1a24", "#6b4fa3", "#e5c77c"],
  specialty: ["#16201c", "#2f7a5c", "#9ff0c9"],
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function ServiceArt({ slug, category, className }: { slug: string; category: string | null; className?: string }) {
  const [a, b, c] = PALETTES[category ?? ""] ?? ["#15181c", "#3d434c", "#e5c77c"];
  const h = hash(slug);
  const angle = h % 360;
  const x = 20 + (h % 60);
  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" className={cn("block", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`g-${slug}`} gradientTransform={`rotate(${angle} .5 .5)`}>
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <radialGradient id={`r-${slug}`} cx={`${x}%`} cy="30%" r="60%">
          <stop offset="0" stopColor={c} stopOpacity="0.55" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#g-${slug})`} />
      <rect width="400" height="250" fill={`url(#r-${slug})`} />
      <path d="M60 190c8-30 34-48 80-55l70-10c26-26 66-46 118-50 52-3 92 15 118 45" fill="none" stroke={c} strokeOpacity="0.35" strokeWidth="3" />
      <path d="M40 210h330" stroke="#fff" strokeOpacity="0.08" strokeWidth="2" />
    </svg>
  );
}
