import { Phone } from "lucide-react";
import Link from "next/link";
import { business } from "@/config/business";
import { buttonVariants } from "@/components/ui/button";
import { NAV } from "@/lib/site/nav";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

export function Header({ minimal = false }: { minimal?: boolean }) {
  return (
    <header
      className="pointer-events-none sticky top-0 z-50 px-3 pt-3 md:px-5"
      style={{ viewTransitionName: "site-header" }}
    >
      {/* Floating glass island, detached from the top edge. */}
      <div className="pointer-events-auto mx-auto flex h-[calc(var(--header-h)-0.75rem)] max-w-[78rem] items-center justify-between gap-4 rounded-full border border-white/[0.08] bg-[#0b0d10]/70 pr-2 pl-5 shadow-[0_20px_60px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-2xl">
        <Link href="/" className="rounded-lg" aria-label={`${business.name} — home`}>
          <Logo />
        </Link>
        {!minimal && (
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center rounded-full px-3.5 text-[0.9rem] font-medium text-fg-muted transition-colors duration-300 hover:bg-white/[0.05] hover:text-fg"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="flex items-center gap-2">
          <a
            href={`tel:${business.contact.phone}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden md:inline-flex")}
          >
            <Phone aria-hidden="true" />
            {/* Logo, nav and full number don't fit on small laptops: icon only there. */}
            <span className="tabular lg:max-xl:sr-only">{business.contact.phoneDisplay}</span>
          </a>
          <Link href="/book" className={cn(buttonVariants({ size: "sm" }), "hidden min-h-11 shadow-[0_10px_30px_-12px_var(--brand),inset_0_1px_0_rgb(255_255_255/0.35)] sm:inline-flex")}>
            Book Now
          </Link>
          {!minimal && <MobileMenu phone={business.contact.phone} phoneDisplay={business.contact.phoneDisplay} />}
        </div>
      </div>
    </header>
  );
}
