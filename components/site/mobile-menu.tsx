"use client";
/**
 * Mobile navigation drawer on the native <dialog> element: showModal() gives the focus trap,
 * Escape to close and an inert background without shipping a dialog library on every page.
 */
import { Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
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
        className={`${buttonVariants({ variant: "ghost", size: "icon" })} lg:hidden`}
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
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(22rem,88vw)] max-w-none flex-col gap-6 overflow-y-auto border-l border-white/10 bg-ink-850 p-5 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:animate-fade-in"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-sm font-semibold tracking-[0.18em] text-fg-subtle uppercase">
            Menu
          </h2>
          <button type="button" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Close menu" onClick={() => dialog.current?.close()}>
            <X aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Mobile">
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="flex min-h-12 items-center rounded-xl px-3 text-lg font-semibold text-fg hover:bg-white/[0.05] aria-[current=page]:text-gold-300"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <a href={`tel:${phone}`} className={buttonVariants({ variant: "secondary" })}>
            <Phone aria-hidden="true" /> {phoneDisplay}
          </a>
          <Link href="/book" className={buttonVariants()}>
            Book Your Detail
          </Link>
        </div>
      </dialog>
    </>
  );
}
