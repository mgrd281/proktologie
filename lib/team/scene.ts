/**
 * Geometrie der Team-Szene – reine Mathematik, kein DOM.
 *
 * Modell: Die sechs Porträts liegen als Ebenen („Bild-Planes") auf einem
 * leicht geschwungenen Pfad, der in die Tiefe führt. Der Scroll-Fortschritt
 * bewegt eine KAMERA an diesem Pfad entlang – die Ebenen selbst bleiben an
 * ihrem Ort. Genau das erzeugt den Eindruck einer zusammenhängenden Szene
 * statt sechs einzeln animierter Karten.
 *
 * Haltepunkte (t = progress · 7):
 *   t = 0        Intro – Kamera vor der ersten Ebene, alle sechs in der Tiefe
 *   t = 1 … 6    Mitglied 1 … 6 im Fokus
 *   t = 7        Finale – Kamera zieht zurück, Gruppenkomposition
 *
 * Weil hier nichts vom Browser abhängt, ist die Komposition ohne Browser
 * prüfbar (siehe lib/team/scene.test.mjs).
 */

export const MEMBER_COUNT = 6;
/** Anzahl der Haltepunkte inklusive Intro (0) und Finale (7). */
export const STOP_COUNT = MEMBER_COUNT + 2;
/** Letzter Index auf der t-Achse. */
export const T_MAX = STOP_COUNT - 1;

export interface SceneGeometry {
  /** CSS-Perspektive der Bühne in px. */
  perspective: number;
  /** Abstand der Ebenen entlang der Blickrichtung. */
  spacingZ: number;
  /** Seitlicher Versatz zwischen benachbarten Ebenen. */
  spacingX: number;
  /** Maximale Zuwendung der Ebenen zur Kamera in Grad. */
  maxYaw: number;
  /** Kamerarückzug im Finale. */
  pullback: number;
  /** Ebenenbreite in px (Höhe = ×1.25, Seitenverhältnis 4:5). */
  cardWidth: number;
  /**
   * Tiefe, ab der eine Ebene ganz ausgeblendet wird. Auf Mobilgeräten
   * bewusst knapp: weniger gleichzeitig gezeichnete Bildebenen entlasten
   * schwächere Grafikeinheiten, ohne dass die Nachbarn verschwinden.
   */
  visibleDepth: number;
}

/** Desktop: weite, editorial-asymmetrische Bühne. */
export const DESKTOP: SceneGeometry = {
  perspective: 1400,
  spacingZ: 520,
  spacingX: 540,
  maxYaw: 16,
  pullback: 1750,
  cardWidth: 420,
  visibleDepth: 5200,
};

/**
 * Mobil ist KEIN geschrumpfter Desktop: flachere Perspektive, engere
 * Staffelung, kaum Drehung – ein dominantes Porträt, Nachbarn angeschnitten.
 */
export const MOBILE: SceneGeometry = {
  perspective: 900,
  spacingZ: 380,
  spacingX: 250,
  maxYaw: 7,
  pullback: 1250,
  cardWidth: 285,
  visibleDepth: 1150,
};

/** Seitlicher Schwung des Pfades – verhindert eine gerade Linie. */
const WAVE = [-140, 90, -70, 130, -110, 50];
/** Tiefen-Feinversatz, damit die Staffelung nicht mechanisch wirkt. */
const DEPTH = [0, -90, 40, -60, 30, -20];
/** Höhenversatz – editorial, nie alle Ebenen auf einer Linie. */
const Y_OFFSET = [-40, 34, -72, 52, -18, 64];

/**
 * Richtung, in die eine passierte Ebene aus dem Bild gleitet: entgegen der
 * Fahrtrichtung der Kamera an dieser Stelle des Pfades – so, wie man an
 * jemandem vorbeigeht. Aus dem Pfad abgeleitet (nicht handgesetzt), damit
 * die Richtung stimmig bleibt, falls der Schwung später verändert wird;
 * konstant pro Ebene, damit niemand mitten im Bild die Seite wechselt.
 */
function driftDirection(index: number, geo: SceneGeometry): number {
  const a = index < MEMBER_COUNT - 1 ? index : index - 1;
  const delta = basePosition(a + 1, geo).x - basePosition(a, geo).x;
  return delta === 0 ? -1 : -Math.sign(delta);
}

/**
 * Gruppenaufstellung des Finales: ein leichter Bogen (wie bei einem
 * Gruppenfoto), zusätzlich in der Tiefe versetzt – bewusst kein flaches
 * Raster und keine Reihe auf einer Linie.
 */
const FINALE_X = [-1.7, -1.02, -0.34, 0.34, 1.02, 1.7];
const FINALE_Y = [0.5, -0.05, -0.42, -0.45, -0.02, 0.52];
const FINALE_Z = [-140, -300, -70, -330, -110, -260];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Ruheposition der Ebene i im Szenenraum. */
export function basePosition(index: number, geo: SceneGeometry): Vec3 {
  return {
    x: (index - (MEMBER_COUNT - 1) / 2) * geo.spacingX + WAVE[index],
    y: Y_OFFSET[index],
    z: -index * geo.spacingZ + DEPTH[index],
  };
}

/** Weiche Ein-/Ausblendung zwischen zwei Schwellen (Hermite). */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Kameraposition bei t. Zwischen zwei Ebenen wird mit smoothstep
 * interpoliert: die Fahrt beschleunigt und bremst sanft, statt zwischen
 * den Stationen mechanisch durchzulaufen.
 */
export function cameraAt(t: number, geo: SceneGeometry): Vec3 {
  const clamped = clamp(t, 0, T_MAX);

  // Intro (t 0→1): Kamera nähert sich der ersten Ebene aus der Ferne.
  if (clamped <= 1) {
    const first = basePosition(0, geo);
    const e = smoothstep(0, 1, clamped);
    // Im Intro steht die Kamera links der ersten Ebene: die Porträts
    // liegen dadurch rechts in der Tiefe, links bleibt Raum für die Headline.
    return {
      x: lerp(first.x - geo.spacingX * 1.15, first.x, e),
      y: lerp(first.y - 40, first.y, e),
      z: lerp(first.z + geo.spacingZ * 1.6, first.z, e),
    };
  }

  // Finale (t 6→7): Kamera zieht zurück und zentriert die Gruppe.
  if (clamped >= MEMBER_COUNT) {
    const last = basePosition(MEMBER_COUNT - 1, geo);
    const e = smoothstep(MEMBER_COUNT, T_MAX, clamped);
    return {
      x: lerp(last.x, 0, e),
      y: lerp(last.y, 0, e),
      z: lerp(last.z, last.z + geo.pullback, e),
    };
  }

  // Zwischen Mitglied n und n+1 entlanggleiten.
  const from = basePosition(Math.floor(clamped) - 1, geo);
  const to = basePosition(Math.ceil(clamped) - 1, geo);
  const e = smoothstep(0, 1, clamped - Math.floor(clamped));
  return {
    x: lerp(from.x, to.x, e),
    y: lerp(from.y, to.y, e),
    z: lerp(from.z, to.z, e),
  };
}

export interface CardState {
  /** Verschiebung relativ zur Kamera (px, CSS-translate3d). */
  x: number;
  y: number;
  z: number;
  /** Drehung zur Kamera in Grad. */
  rotateX: number;
  rotateY: number;
  opacity: number;
  /** Unschärfestufe 0–2 (0 = scharf) – wird als Klasse gesetzt, nicht pro Frame. */
  blurStep: 0 | 1 | 2;
}

/**
 * Zustand der Ebene i bei Fortschritt t.
 *
 * Die Bühnenmaße skalieren die Finale-Aufstellung: Die Gruppe wird aus der
 * tatsächlichen Bühnenbreite abgeleitet, damit alle sechs auf jedem
 * Bildschirm nebeneinander Platz finden, statt sich zu überdecken.
 */
export function cardState(
  index: number,
  t: number,
  geo: SceneGeometry,
  viewport: { w: number; h: number },
): CardState {
  const base = basePosition(index, geo);
  const cam = cameraAt(t, geo);

  let x = base.x - cam.x;
  let y = base.y - cam.y;
  let z = base.z - cam.z;

  /*
   * Passierte Ebenen (z > 0) dürfen nicht ungebremst auf die Kamera
   * zulaufen: nahe der Projektionsebene (z → perspective) explodiert die
   * CSS-Perspektive. Statt zu clippen wird die Vorwärtsstrecke asymptotisch
   * gedeckelt (Steigung 1 im Ursprung → kein Knick) und die Ebene gleitet
   * zur Bildkante. Kinematisch ist das der Blick an jemandem vorbei: die
   * Person bleibt als unscharfer Vordergrund präsent, statt zu verschwinden.
   */
  const forwardCap = geo.perspective * 0.25;
  let drifted = 0;
  if (z > 0) {
    const capped = forwardCap * (1 - Math.exp(-z / forwardCap));
    drifted = capped;
    x += driftDirection(index, geo) * capped * 1.35;
    z = capped;
  }

  // Finale: von der Pfadposition in die Gruppenaufstellung überblenden.
  const groupBlend = smoothstep(MEMBER_COUNT, T_MAX, t);
  if (groupBlend > 0) {
    const spread = viewport.w * 0.3;
    x = lerp(x, FINALE_X[index] * spread, groupBlend);
    y = lerp(y, FINALE_Y[index] * viewport.h * 0.22, groupBlend);
    z = lerp(z, FINALE_Z[index] - geo.pullback * 0.42, groupBlend);
  }

  // Zuwendung zur Kamera: seitlich versetzte Ebenen drehen sich leicht ein.
  const yaw = clamp(-x * 0.018, -geo.maxYaw, geo.maxYaw) * (1 - groupBlend * 0.75);
  const pitch = clamp(y * 0.01, -6, 6) * (1 - groupBlend * 0.75);

  // Deckkraft: fällt mit der Tiefe, aber nie unter den Boden – so bleibt die
  // Szene zusammenhängend und die nächste Person ist immer schon zu ahnen.
  const depth = Math.abs(z);
  const far = 1 - smoothstep(geo.spacingZ * 0.9, geo.spacingZ * 4, depth);
  // Passierte Ebenen bleiben als Vordergrund präsent (Boden 0.35), statt
  // hart zu verschwinden – „Karte weg, neue Karte da" wäre genau falsch.
  // Im Finale löst sich dieser Vordergrund-Status auf: die Kamera zieht
  // zurück, alle sechs stehen wieder gleichberechtigt in der Szene.
  const passedFactor = 0.42 + 0.58 * (1 - smoothstep(0, 220, drifted));
  const passed = passedFactor + (1 - passedFactor) * groupBlend;
  // Sehr weit entfernte Ebenen ganz ausblenden – spart gezeichnete Flächen.
  // Im Finale hebt sich die Begrenzung auf: dort gehören alle sechs ins Bild.
  const range = 1 - smoothstep(geo.visibleDepth * 0.75, geo.visibleDepth, depth);
  const inRange = range + (1 - range) * groupBlend;
  const opacity = clamp(Math.min(0.3 + far * 0.7, passed) * inRange, 0, 1);

  // Vordergrund-Ebenen leicht defokussieren (wie eine echte Kamera),
  // Tiefe stufenweise – die Stufe wird als Klasse gesetzt, nicht pro Frame.
  const foreground = drifted > 80 && groupBlend < 0.5;
  const blurStep: CardState["blurStep"] =
    foreground ? 1 : depth < geo.spacingZ * 0.8 ? 0 : depth < geo.spacingZ * 2 ? 1 : 2;

  return { x, y, z, rotateX: pitch, rotateY: yaw, opacity, blurStep };
}

/**
 * Bildschirmposition eines Szenenpunkts – identisches Modell wie die
 * CSS-Perspektive, damit die Verbindungslinie exakt auf den Ebenen sitzt.
 */
export function project(
  state: Pick<CardState, "x" | "y" | "z">,
  geo: SceneGeometry,
): { x: number; y: number; visible: boolean } {
  const denominator = geo.perspective - state.z;
  if (denominator <= 1) return { x: 0, y: 0, visible: false };
  const k = geo.perspective / denominator;
  return { x: state.x * k, y: state.y * k, visible: true };
}

/** Aktives Kapitel (0 = Intro, 1–6 = Mitglied, 7 = Finale). */
export function chapterAt(t: number): number {
  return clamp(Math.round(t), 0, T_MAX);
}

/** Fortschritt (0–1), bei dem Kapitel `stop` mittig steht. */
export function progressForStop(stop: number): number {
  return clamp(stop / T_MAX, 0, 1);
}
