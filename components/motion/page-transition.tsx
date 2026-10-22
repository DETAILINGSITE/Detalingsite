import { ViewTransition, type ReactNode } from "react";

/**
 * Route cross-fade (React 19.3 <ViewTransition>; Next 16.4 navigations are transitions).
 * Browsers without the View Transitions API get the CSS opacity fallback instead.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-fade" exit="page-fade" default="none">
      <div className="route-fallback-fade">{children}</div>
    </ViewTransition>
  );
}
