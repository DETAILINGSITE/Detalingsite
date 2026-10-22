"use client";
import { BarChart3, CalendarDays, ClipboardList, FileText, Inbox, LogOut, MapPinned, Percent, Settings, Shield, Tags, Users, Clock, Download } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/quotes", label: "Quotes", icon: FileText },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/catalog", label: "Catalog", icon: Tags },
  { href: "/admin/schedule", label: "Schedule", icon: Clock },
  { href: "/admin/area", label: "Service area", icon: MapPinned },
  { href: "/admin/promos", label: "Promo codes", icon: Percent },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings, owner: true },
  { href: "/admin/export", label: "Export", icon: Download, owner: true },
  { href: "/admin/security", label: "Security", icon: Shield },
];

export function AdminNav({ role, name }: { role: "owner" | "staff"; name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {ITEMS.filter((i) => !i.owner || role === "owner").map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-fg-muted hover:bg-white/[0.05] hover:text-fg", active && "bg-white/[0.07] text-fg")}
          >
            <i.icon className="size-4.5" aria-hidden="true" /> {i.label}
          </Link>
        );
      })}
      <div className="mt-4 border-t border-white/[0.08] pt-4 text-xs text-fg-subtle">
        Signed in as {name} ({role})
      </div>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          router.push("/admin/login");
        }}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-fg-muted hover:bg-white/[0.05]"
      >
        <LogOut className="size-4.5" aria-hidden="true" /> Sign out
      </button>
    </nav>
  );
}
