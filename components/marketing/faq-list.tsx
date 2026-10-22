"use client";
/** Accessible accordion (Radix). Content fades (opacity only) — no height animation. */
import { ChevronDown } from "lucide-react";
import { Accordion } from "radix-ui";

export function FaqList({ items }: { items: { id: string; question: string; answer: string }[] }) {
  return (
    <Accordion.Root type="multiple" className="flex flex-col divide-y divide-white/[0.08] border-y border-white/[0.08]">
      {items.map((f) => (
        <Accordion.Item key={f.id} value={f.id}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left text-lg font-semibold">
              {f.question}
              <ChevronDown className="size-5 shrink-0 text-fg-subtle transition-transform duration-300 group-data-[state=open]:rotate-180" aria-hidden="true" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="data-[state=open]:animate-fade-in">
            <p className="max-w-3xl pb-5 leading-relaxed text-fg-muted">{f.answer}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
