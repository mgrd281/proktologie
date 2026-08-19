/**
 * Geometrie des Leistungs-Korridors – reine Mathematik, kein DOM.
 *
 * Zustand 03 zeigt die acht Leistungen NICHT als Kartenraster, sondern als
 * schwebende Tafeln in der Tiefe: Vier Stationen zu je zwei Tafeln liegen
 * hintereinander auf einem Korridor rechts der Textspalte; der lokale
 * Scroll-Fortschritt bewegt eine Kamera hindurch. Die fokussierte Station
 * steht nah und lesbar, die übrigen warten in der Tiefe oder sind bereits
 * passiert.
 *
 * Vier Stationen statt acht Einzelstopps: Der Zustand ist 0.11 der Fahrt
 * (~121vh Scroll) – acht Stopps wären 15vh je Stopp und unter der Lenis-
 * Trägheit unlesbar. Vier Stationen ergeben die Kadenz der Team-Szene.
 *
 * Alles hier ist ohne Browser prüfbar (lib/cinema/leistungen.test.mjs).
 */

export const PANEL_COUNT = 8;
export const STATION_COUNT = 4;
/** t-Achse des Korridors: Station s steht bei t = s + 0.5 im Fokus. */
export const T_MAX = STATION_COUNT;

/** Beginn und Ende der Kamerafahrt auf der t-Achse. */
export const T_START = 0.35;
export const T_END = STATION_COUNT - 0.5;

/**
 * Korridorzeit aus dem lokalen Zustands-Fortschritt. Die Fahrt endet AUF
 * der letzten Station (t = 3.5), nicht hinter ihr: Die Tafeln verlassen
 * die Bühne über die Ebenen-Blende in den Symptom-Zustand hinein – nicht,
 * indem die Kamera an allen vorbeigefahren ist und ins Leere blickt.
 */
export function corridorTime(local: number): number {
  return T_START + clamp(local) * (T_END - T_START);
}

export interface CorridorGeometry {
  /** CSS-Perspektive der Bühne in px (nur informativ – die Projektion rechnet selbst). */
  perspective: number;
  /** Tiefenabstand zwischen den Stationen in px. */
  spacingZ: number;
  /**
   * Fluchtpunkt der Spur als Anteil der Bühnenbreite/-höhe. Bewusst rechts
   * der Mitte: Auch tief im Raum bleiben die Tafeln rechts – links gehört
   * die Spalte dem Zustandstext.
   */
  vanishX: number;
  vanishY: number;
  /** Grundposition der beiden Tafeln einer Station (Anteil der Breite/Höhe, relativ zum Fluchtpunkt). */
  pairX: [number, number];
  pairY: [number, number];
  /**
   * Seitlicher Schritt je Station Tiefe: Der Korridor läuft diagonal auf
   * den Fluchtpunkt zu und die Kamera fährt seitlich mit. Ohne diesen
   * Schritt projizierten gleichplatzierte Tafeln aufeinanderfolgender
   * Stationen fast auf denselben Bildpunkt – Schrift stünde auf Schrift.
   */
  stationStepX: number;
  /** Tafelbreite in px an der Fokusebene. */
  panelWidth: number;
  /** Tiefe (in Stationen), ab der eine Tafel ganz ausgeblendet ist. */
  visibleAhead: number;
  /** Wie weit hinter der Kamera (in Stationen) eine passierte Tafel noch sichtbar bleibt. */
  visibleBehind: number;
}

/** Desktop: Korridor in der rechten Bühnenhälfte. */
export const DESKTOP: CorridorGeometry = {
  perspective: 1200,
  spacingZ: 520,
  vanishX: 0.6,
  vanishY: 0.44,
  /*
   * Diagonal versetzt: Die beiden Tafeln einer Station stehen 0.22 der
   * Breite und 0.25 der Höhe auseinander – deutlich mehr als eine
   * Tafel misst, damit sich an der Fokusebene nichts überlappt.
   */
  pairX: [0.04, 0.22],
  pairY: [-0.16, 0.09],
  stationStepX: 0.16,
  panelWidth: 300,
  visibleAhead: 2.6,
  visibleBehind: 0.45,
};

/**
 * Mobil ist KEIN geschrumpfter Desktop, sondern eine vertikale Drift:
 * keine Perspektive, keine Drehung, höchstens drei sichtbare Tafeln –
 * die Tafeln ziehen als ruhige Liste durchs Bild.
 */
export const MOBILE: CorridorGeometry = {
  perspective: 0,
  spacingZ: 0,
  vanishX: 0.5,
  vanishY: 0.6,
  pairX: [0, 0],
  pairY: [0, 0],
  stationStepX: 0,
  panelWidth: 300,
  visibleAhead: 1.1,
  visibleBehind: 0.55,
};

export interface PanelState {
  /** Position des Tafelzentrums als Anteil der Bühnenbreite/-höhe. */
  x: number;
  y: number;
  scale: number;
  opacity: number;
  /** 1 im Fokus, 0 in der Tiefe – steuert die Lesbarkeit des Teasers. */
  focus: number;
  /** Diskreter Tiefenschleier (0 = klar, 1 = fern, 2 = sehr fern) – nie filter. */
  blurStep: 0 | 1 | 2;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Station und Spaltenplatz einer Tafel. */
export function stationOf(index: number): { station: number; slot: 0 | 1 } {
  return { station: Math.floor(index / 2), slot: (index % 2) as 0 | 1 };
}

/**
 * Zustand einer Tafel bei Korridorzeit t (0 … STATION_COUNT).
 *
 * `rel` ist die Tiefe der Station relativ zur Kamera in Stationen:
 * positiv = noch vor uns, 0 = Fokusebene, negativ = passiert. Auf dem
 * Desktop wird daraus eine echte Zentralprojektion auf den Fluchtpunkt;
 * mobil eine vertikale Drift ohne Perspektive.
 */
export function panelState(
  index: number,
  t: number,
  geo: CorridorGeometry,
): PanelState {
  const { station, slot } = stationOf(index);
  const rel = station + 0.5 - t;

  // Sichtbarkeit: weich herein aus der Tiefe, zügig hinaus nach dem Passieren
  const appear = 1 - smoothstep(geo.visibleAhead - 0.9, geo.visibleAhead, rel);
  const gone = smoothstep(geo.visibleBehind * 0.35, geo.visibleBehind, -rel);
  const visible = appear * (1 - gone);

  // Fokus: voll auf der Fokusebene, weich zu beiden Seiten – auch auf
  // halber Strecke zwischen zwei Stationen bleibt Lesbares im Bild.
  const focus = 1 - smoothstep(0.18, 0.75, Math.abs(rel));

  if (geo.perspective <= 0) {
    // Mobil: vertikale Drift, Tafel um Tafel (2 Tafeln je Station versetzt).
    // Die Sichtbarkeit hängt hier an der EIGENEN Driftposition der Tafel –
    // so sind nie mehr als drei gleichzeitig im Bild.
    const u = rel * 2 + (slot === 0 ? -0.5 : 0.5);
    const vis = 1 - smoothstep(0.85, 1.35, Math.abs(u));
    return {
      x: geo.vanishX,
      y: geo.vanishY + u * 0.3,
      scale: 1 - Math.min(0.14, Math.abs(u) * 0.05),
      opacity: vis * (0.35 + 0.65 * focus),
      focus,
      blurStep: 0,
    };
  }

  const depth = rel * geo.spacingZ;
  // Zentralprojektion; hinter der Kamera wächst k über 1 – die Tafel
  // schiebt sich am Betrachter vorbei nach außen, bevor sie ausblendet.
  const k = geo.perspective / Math.max(geo.perspective * 0.35, geo.perspective + depth);

  // Kamera fährt seitlich mit: an der Fokusebene steht jede Station im
  // selben Bildausschnitt, tiefere warten weiter rechts, passierte
  // schwingen nach links aus.
  const baseX = geo.pairX[slot] + rel * geo.stationStepX;
  const baseY = geo.pairY[slot];

  return {
    x: geo.vanishX + baseX * k,
    y: geo.vanishY + baseY * k,
    scale: Math.min(1.9, k),
    /*
     * Deckkraft hängt am FOKUS, nicht an der Tiefe allein: Die wartenden
     * Stationen sind leise Silhouetten (Grundwert 0.16), erst die
     * Fokusebene trägt volle Schrift – sonst stünden vier Tafeltexte
     * gleichzeitig als Geisterschrift übereinander.
     */
    opacity: visible * (0.16 + 0.84 * focus),
    focus,
    blurStep: rel > 1.7 ? 2 : rel > 0.85 ? 1 : 0,
  };
}

/** Fokussierte Station (für Zähler/ARIA) bei Korridorzeit t. */
export function activeStation(t: number): number {
  return Math.min(STATION_COUNT - 1, Math.max(0, Math.floor(t)));
}
