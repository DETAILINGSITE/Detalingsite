import { Suspense } from "react";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "@/components/admin/login-form";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Admin sign in", description: "Admin sign in", path: "/admin/login", noindex: true });

export default function AdminLoginPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Admin sign in</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
