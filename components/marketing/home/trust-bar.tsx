/** The three promises from the price flyer, plus the craft words, as a slow display marquee. */
const PROMISES = [
  { title: "Professional", label: "Quality products on every job" },
  { title: "100% mobile", label: "We come to you" },
  { title: "Satisfaction guaranteed", label: "Backed by our guarantee" },
];
const WORDS = ["Professional", "Paint correction", "100% mobile", "Ceramic coating", "Satisfaction guaranteed", "Interior deep clean", "7 days a week"];

export function TrustBar() {
  const row = (
    <ul className="flex shrink-0 items-center" aria-hidden="true">
      {WORDS.map((w, i) => (
        <li key={w} className="flex items-center">
          <span
            className={
              i % 2
                ? "serif px-8 text-[clamp(2.2rem,5vw,4.2rem)] leading-none text-fg-muted md:px-12"
                : "px-8 font-display text-[clamp(2rem,4.6vw,3.8rem)] leading-none font-extrabold tracking-[-0.03em] text-transparent [-webkit-text-stroke:1px_rgb(244_243_239/0.55)] md:px-12"
            }
          >
            {w}
          </span>
          <span className="size-2.5 rounded-full bg-gold-400 shadow-[0_0_18px_4px_rgb(77_163_255/0.55)]" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Why customers trust us" className="relative overflow-hidden border-y border-white/[0.06] py-10 md:py-14">
      <ul className="sr-only">
        {PROMISES.map((p) => (
          <li key={p.title}>
            {p.title}: {p.label}
          </li>
        ))}
      </ul>
      <div className="marquee [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="marquee-track">
          {row}
          {row}
        </div>
      </div>
    </section>
  );
}
