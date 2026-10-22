import { CalendarCheck, MessageSquare, Phone } from "lucide-react";
import Link from "next/link";
import { business } from "@/config/business";

/** Sticky Call / Text / Book bar on phones (hidden ≥ md). */
export function MobileBar() {
  const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold";
  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="flex h-[var(--mobile-bar-h)] items-stretch">
        <a href={`tel:${business.contact.phone}`} className={`${item} text-fg`}>
          <Phone className="size-5" aria-hidden="true" />
          Call
        </a>
        <a href={`sms:${business.contact.sms}`} className={`${item} text-fg`}>
          <MessageSquare className="size-5" aria-hidden="true" />
          Text
        </a>
        <Link href="/book" className={`${item} m-2 rounded-2xl bg-[var(--brand)] text-ink-950`}>
          <CalendarCheck className="size-5" aria-hidden="true" />
          Book Now
        </Link>
      </div>
    </nav>
  );
}
