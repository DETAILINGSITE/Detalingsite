/**
 * "Only animate transform and opacity" (docs/PLAN.md §6). Every tween in the motion
 * engine goes through `safeVars`, which throws in dev/test on layout properties.
 */
const ALLOWED = new Set([
  "x", "y", "z", "xPercent", "yPercent", "rotation", "rotate", "rotationX", "rotationY", "rotateX", "rotateY",
  "scale", "scaleX", "scaleY", "skewX", "skewY", "opacity", "autoAlpha", "transformOrigin", "transformPerspective", "force3D",
  // tween controls (not CSS properties)
  "duration", "delay", "ease", "stagger", "repeat", "yoyo", "repeatDelay", "paused", "overwrite", "immediateRender",
  "onStart", "onUpdate", "onComplete", "scrollTrigger", "clearProps", "id", "easeReverse", "snap", "textContent",
  "innerText", "onReverseComplete", "lazy", "data",
]);

export function disallowedKeys(vars: Record<string, unknown>): string[] {
  return Object.keys(vars).filter((k) => !ALLOWED.has(k));
}

export function safeVars<T extends Record<string, unknown>>(vars: T): T {
  const bad = disallowedKeys(vars);
  if (bad.length && process.env.NODE_ENV !== "production") {
    throw new Error(`Motion guard: only transform/opacity may be animated (got: ${bad.join(", ")})`);
  }
  return vars;
}
