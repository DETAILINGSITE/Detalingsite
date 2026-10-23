/**
 * FAQ list on native <details>/<summary>: keyboard and screen-reader support built in,
 * no client JavaScript. Opening fades the answer in (opacity only), no height animation.
 */
import { ChevronDown } from "lucide-react";

export function FaqList({ items }: { items: { id: string; question: string; answer: string }[] }) {
  return (
    <div className="flex flex-col divide-y divide-white/[0.08] border-y border-white/[0.08]">
      {items.map((f) => (
        <details key={f.id} className="group">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-lg font-semibold [&::-webkit-details-marker]:hidden">
            <h3 className="text-lg font-semibold">{f.question}</h3>
            <ChevronDown className="size-5 shrink-0 text-fg-subtle transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="max-w-3xl pb-5 leading-relaxed text-fg-muted group-open:animate-fade-in">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
