/** Human-friendly reference numbers (Crockford base32: no I, L, O, U). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomCode(length: number, random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[(bytes[i] ?? 0) % 32];
  return out;
}

function defaultRandom(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function bookingNumber(prefix: string): string {
  return `${prefix}-${randomCode(6)}`;
}

export function quoteNumber(prefix: string): string {
  return `Q${prefix}-${randomCode(6)}`;
}
