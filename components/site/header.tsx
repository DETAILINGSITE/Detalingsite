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
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-ink-900/65"
      style={{ viewTransitionName: "site-header" }}
    >
      <div className="container-site flex h-[var(--header-h)] items-center justify-between gap-4">
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
                    className="inline-flex min-h-11 items-center rounded-full px-3.5 text-[0.92rem] font-medium text-fg-muted transition-colors hover:text-fg"
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
            <span className="tabular">{business.contact.phoneDisplay}</span>
          </a>
          <Link href="/book" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
            Book Now
          </Link>
          {!minimal && <MobileMenu phone={business.contact.phone} phoneDisplay={business.contact.phoneDisplay} />}
        </div>
      </div>
    </header>
  );
}
