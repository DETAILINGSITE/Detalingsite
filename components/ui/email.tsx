"use client";

import { useSyncExternalStore } from "react";

/*
 * The live domain is proxied by Cloudflare, whose Email Address Obfuscation rewrites any address
 * it finds in the HTML into a "[email protected]" placeholder plus a decode script (which our CSP
 * blocks). React then hydrates against markup it never rendered and throws error #418. Rendering
 * the address only after hydration keeps it out of the HTML, so there is nothing to rewrite.
 */
const subscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** The address as text; `fallback` stands in for it in the server HTML. */
export function EmailText({ email, fallback = null }: { email: string; fallback?: React.ReactNode }) {
  return <>{useHydrated() ? email : fallback}</>;
}

/** A mailto: link showing the address; the server HTML has a plain "Email us" label instead. */
export function EmailLink({ email, className }: { email: string; className?: string }) {
  const hydrated = useHydrated();
  if (!hydrated) return <span className={className}>Email us</span>;
  return (
    <a href={`mailto:${email}`} className={className}>
      {email}
    </a>
  );
}
