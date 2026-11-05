"use client";
/**
 * Mobile navigation on the native <dialog> element: showModal() gives the focus trap,
 * Escape to close and an inert background without shipping a dialog library on every page.
 * Opens as a full-screen glass overlay; links rise in one after another (CSS only, so the
 * animation replays each time the dialog opens and is skipped under reduced motion).
 */
import { Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { CtaLink } from "@/components/ui/cta-link";
import { NAV } from "@/lib/site/nav";

/** Contact details come from the server-rendered header, so the full business config stays off the client. */
export function MobileMenu({ phone, phoneDisplay }: { phone: string; phoneDisplay: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        className={`${buttonVariants({ variant: "ghost", size: "icon" })} rounded-full lg:hidden`}
        aria-label="Open menu"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <Menu aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        // Backdrop clicks land on the <dialog> itself; following any link inside also closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) e.currentTarget.close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-y-auto bg-[#07080a]/90 px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-fg backdrop-blur-3xl backdrop:bg-black/40 open:flex open:animate-fade-in"
      >
        <div className="flex h-[calc(var(--header-h)-0.75rem)] items-center justify-between rounded-full border border-white/[0.08] bg-white/[0.03] pr-2 pl-5">
          <h2 id={titleId} className="text-[0.7rem] font-semibold tracking-[0.3em] text-fg-subtle uppercase">
            Menu
          </h2>
          <button
            type="button"
            className={`${buttonVariants({ variant: "ghost", size: "icon" })} rounded-full border border-white/10`}
            aria-label="Close menu"
            onClick={() => dialog.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Mobile" className="mt-8">
          <ul className="flex flex-col">
            {NAV.map((item, i) => (
              <li key={item.href} className="animate-rise border-b border-white/[0.06]" style={{ animationDelay: `${60 + i * 45}ms` }}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="group flex min-h-16 items-center gap-4 text-[clamp(1.7rem,8vw,2.4rem)] leading-none font-bold tracking-[-0.03em] text-fg transition-colors duration-300 aria-[current=page]:text-gold-300"
                >
                  <span className="tabular w-7 text-xs font-medium tracking-normal text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
                  <span className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1.5">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex animate-rise flex-col gap-3 pt-10 [animation-delay:420ms]">
          <CtaLink href={`tel:${phone}`} variant="glass" className="w-full" magnetic={false}>
            <span className="inline-flex items-center gap-2">
              <Phone aria-hidden="true" className="size-4" /> {phoneDisplay}
            </span>
          </CtaLink>
          <CtaLink href="/book" className="w-full" magnetic={false}>
            Book Your Detail
          </CtaLink>
        </div>
      </dialog>
    </>
  );
}
