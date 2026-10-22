/**
 * Placeholder registry.
 *
 * Every business value we don't know yet is wrapped in `ph(value, key, hint)`.
 * The value is used as-is (so the site works in development), the key is recorded,
 * and `pnpm launch-check` fails while any key remains. The README's
 * "Values to fill in" list is generated from the same registry, and a unit test
 * keeps the two in sync.
 *
 * To fill a value in, replace `ph("…", "key", "hint")` with the plain value.
 */
export interface PlaceholderEntry {
  key: string;
  hint: string;
}

const registry = new Map<string, PlaceholderEntry>();

export function ph<T>(value: T, key: string, hint: string): T {
  registry.set(key, { key, hint });
  return value;
}

export function listPlaceholders(): PlaceholderEntry[] {
  return [...registry.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function isPlaceholder(key: string): boolean {
  return registry.has(key);
}
