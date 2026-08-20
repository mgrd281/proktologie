/**
 * Die Blenden-Primitiven der Kamerafahrt – reine Mathematik, kein DOM.
 *
 * Die Dramaturgie selbst (Szenen, Frames, Bänder, Anker) lebt in
 * lib/cinema/frames.ts – der Master-FRAME-Timeline. Hier stehen nur die
 * einheitenlosen Bausteine, aus denen jedes Band gebaut ist; sie
 * funktionieren auf der Frame-Achse genauso wie auf 0–1.
 */

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Weiche Ein-/Ausblendung zwischen zwei Schwellen (Hermite). */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Gewicht einer Ebene bei Position p (Frame oder Fortschritt):
 * 0 vor `inStart`, sanft auf 1 bis `inEnd`, 1 bis `outStart`,
 * sanft zurück auf 0 bis `outEnd`. Weil jede Ebene ein Band trägt, das
 * früher beginnt und später endet als ihre Szene, überblendet der Film –
 * er schneidet nie.
 */
export function band(
  p: number,
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
): number {
  return smoothstep(inStart, inEnd, p) * (1 - smoothstep(outStart, outEnd, p));
}

/**
 * Zyklus INNERHALB einer Ebene: `count` gleich breite Fenster über den
 * lokalen Fortschritt 0–1, mit weicher Blende `overlap` zwischen den
 * Fenstern. Erstes Fenster ist von Anfang an voll da, letztes bleibt bis
 * zum Schluss – die Ebene selbst blendet ja bereits als Ganzes.
 * (Gemeinsame Primitive für Symptom-Zyklus u. Ä.)
 */
export function cycleWeight(
  local: number,
  index: number,
  count: number,
  overlap: number,
): number {
  const from = index / count;
  const to = (index + 1) / count;
  const inStart = index === 0 ? -1 : from - overlap;
  const inEnd = index === 0 ? 0 : from + overlap;
  const outStart = index === count - 1 ? 1.1 : to - overlap;
  const outEnd = index === count - 1 ? 1.2 : to + overlap;
  return band(local, inStart, inEnd, outStart, outEnd);
}
