/**
 * Suche nach Terminen in der Befehlspalette – was eine Eingabe bedeuten
 * kann. Gesucht wird exakt über die Blind-Indizes (lib/crypto/blindIndex.ts):
 * Namen nur vollständig als Nachname + Vorname, keine Teilstrings – sonst
 * müsste das Cockpit alle Namen entschlüsseln. Reine Funktion, prüfbar mit
 *
 *   node --test lib/booking/search.test.mjs
 */
import { normalizeName } from "../crypto/blindIndex.ts";
import { isRef } from "../ref.ts";

export interface SearchPlan {
  ref?: string;
  email?: string;
  phone?: string;
  /** Mögliche Aufteilungen in Nachname und Vorname – beide Reihenfolgen */
  names: Array<{ last: string; first: string }>;
  /** Ein einzelnes Wort: Für die Namenssuche braucht es Nachname und Vorname */
  needsFullName?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[\d\s+()/.-]+$/;

export function planSearch(query: string): SearchPlan {
  const q = query.trim();
  const plan: SearchPlan = { names: [] };
  if (q.length < 2) return plan;
  if (isRef(q)) plan.ref = q.toUpperCase();
  if (EMAIL.test(q)) plan.email = q;
  if (PHONE.test(q) && q.replace(/\D/g, "").length >= 6) plan.phone = q;
  if (plan.ref || plan.email || plan.phone) return plan;

  const tokens = normalizeName(q).split(" ").filter(Boolean);
  if (tokens.length < 2) {
    plan.needsFullName = tokens.length === 1;
    return plan;
  }
  const seen = new Set<string>();
  for (let k = 1; k < tokens.length; k++) {
    const a = tokens.slice(0, k).join(" ");
    const b = tokens.slice(k).join(" ");
    for (const [last, first] of [
      [a, b],
      [b, a],
    ] as const) {
      const key = `${last}|${first}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plan.names.push({ last, first });
    }
  }
  return plan;
}
