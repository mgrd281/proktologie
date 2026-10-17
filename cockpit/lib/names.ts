/**
 * Namen von Kolleg:innen für Anrede und Kürzel – ohne akademische Titel:
 * „Dr. med. Kai Kunstreich“ heißt in der Begrüßung „Kai“ und im Kürzel „KK“
 * (früher „Guten Tag, Dr..“ und „DM“). Prüfbar mit
 *
 *   node --test lib/names.test.mjs
 */
const TITLE = /^(dr|prof|med|dent|dipl|ing|rer|nat|phil|habil|pd|univ)\.?$/i;

function parts(full: string): string[] {
  return full
    .trim()
    .split(/\s+/)
    .filter((p) => p && !TITLE.test(p) && !/^dr\.-?\w*\.?$/i.test(p));
}

/** Vorname für die Begrüßung – ohne Titel. */
export function firstNameOf(full: string): string {
  return parts(full)[0] ?? full.trim();
}

/** Zwei Buchstaben: erster und letzter Namensteil, ohne Titel. */
export function initialsOf(full: string): string {
  const p = parts(full);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
