import { TwoFactorSetup } from "@/components/admin/two-factor-setup";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/server/admin-guard";

async function Security({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const session = await requireAdminPage({ allowWithout2fa: true });
  const { setup } = await searchParams;
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Security</h1>
      {setup && !session.twoFactorEnabled && (
        <p role="alert" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Owners must turn on two-factor authentication before using the dashboard — it protects customer data and refunds.
        </p>
      )}
      <TwoFactorSetup enabled={session.twoFactorEnabled} />
    </div>
  );
}

/** Outside the (dash) layout on purpose: the layout redirects owners without 2FA here. */
export default function SecurityPage(props: { searchParams: Promise<{ setup?: string }> }) {
  return (
    <main id="main" className="container-site py-12">
      <Link href="/admin" className="mb-6 inline-flex min-h-11 items-center text-sm text-fg-muted hover:text-fg">← Admin</Link>
      <Suspense fallback={null}>
        <Gate {...props} />
      </Suspense>
    </main>
  );
}

async function Gate(props: { searchParams: Promise<{ setup?: string }> }) {
  await connection();
  return <Security {...props} />;
}
