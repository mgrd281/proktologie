import { randomInt } from "node:crypto";

/**
 * Kurze, vorlesbare Referenzen ("PE-4F7K"): Alphabet ohne 0/O/1/I,
 * Präfix je Entität. 32^4 ≈ 1 Mio. Kombinationen – die Eindeutigkeit
 * sichert der Unique-Index, der Aufrufer wiederholt bei Kollision.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makeRef(prefix: "PE" | "AN" | "WL" = "PE", length = 4): string {
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${s}`;
}

export function isRef(value: string): boolean {
  return /^(PE|AN|WL)-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4,6}$/.test(value.toUpperCase());
}
