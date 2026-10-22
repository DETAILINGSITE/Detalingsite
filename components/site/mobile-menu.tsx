"use client";
import { Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { business } from "@/config/business";
import { buttonVariants } from "@/components/ui/button";
import { NAV } from "@/lib/site/nav";
import { cn } from "@/lib/utils";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden")} aria-label="Open menu">
        <Menu aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[101] flex w-[min(22rem,88vw)] flex-col gap-6 overflow-y-auto border-l border-white/10 bg-ink-850 p-5 shadow-2xl data-[state=open]:animate-fade-in">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold tracking-[0.18em] text-fg-subtle uppercase">Menu</Dialog.Title>
            <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Close menu">
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
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
            <a href={`tel:${business.contact.phone}`} className={buttonVariants({ variant: "secondary" })}>
              <Phone aria-hidden="true" /> {business.contact.phoneDisplay}
            </a>
            <Link href="/book" className={buttonVariants()}>
              Book Your Detail
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
