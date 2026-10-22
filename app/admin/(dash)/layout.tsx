import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/nav";
import { Logo } from "@/components/site/logo";
import { requireAdminPage } from "@/lib/server/admin-guard";

export const metadata = { robots: { index: false, follow: false }, title: "Admin" };

/** Every admin page is guarded server-side here AND in each action (proxy is only a fast path). */
async function Shell({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/[0.07] bg-ink-950 p-4 lg:border-r lg:border-b-0">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        <AdminNav role={session.role} name={session.name} />
      </aside>
      <main id="main" className="min-w-0 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-fg-muted">Loading admin…</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
