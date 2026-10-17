"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

/**
 * Bottom-Sheet am Handy nach unten ziehen, um es zu schließen – wie in Apps.
 *
 * Ohne Bibliothek: Motions `drag` bräuchte das größere Funktionspaket
 * (`domMax`, rund 14 KB mehr). Gezogen wird nur am Kopf des Sheets (Griff und
 * Titel), nie im Inhalt, der selbst scrollt; Knöpfe im Kopf bleiben Knöpfe.
 * Die Fläche folgt dem Finger über `transform`; nach oben gibt es keinen
 * Weg (darunter wäre eine Lücke). Losgelassen schließt das Sheet ab
 * `min(120 px, 25 % Höhe)` oder bei einem schnellen Wisch, sonst federt es
 * per CSS zurück (bei reduzierter Bewegung sofort – siehe globals.css).
 *
 * Ziehen ist nie der einzige Weg (WCAG 2.5.7): Schließen-Knopf, Tippen
 * daneben, Esc und die Zurück-Geste tun dasselbe.
 */

/** Erst ab dieser Strecke ist es Ziehen – darunter ein Tippen. */
const SLOP = 6;
const CLOSE_DISTANCE = 120;
/** px/ms – schneller nach unten geworfen schließt auch auf kurzem Weg. */
const FLICK_VELOCITY = 0.5;
const SNAP_BACK = "transform 280ms var(--ease-out-soft)";

interface DragState {
  id: number;
  /** Zeigerposition, an der die Fläche ohne Versatz stünde */
  originY: number;
  startY: number;
  height: number;
  active: boolean;
  lastY: number;
  lastT: number;
  velocity: number;
}

/** Aktueller Versatz der Fläche (z. B. mitten im Zurückfedern). */
function currentOffset(el: HTMLElement): number {
  try {
    return new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
  } catch {
    return 0;
  }
}

/**
 * Gibt den Ref für die Fläche des Sheets zurück (sie folgt dem Finger) und
 * die Zeiger-Handler für den Kopf.
 */
export function useSheetDrag<T extends HTMLElement>(enabled: boolean, onClose: () => void) {
  const sheet = useRef<T>(null);
  const drag = useRef<DragState | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  /** Zurück an die Ruhelage (mit Federweg, falls verschoben). */
  const reset = useCallback(() => {
    const el = sheet.current;
    if (!el || !el.style.transform) return;
    el.style.transition = SNAP_BACK;
    el.style.transform = "";
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const el = sheet.current;
      if (!enabled || !el || !event.isPrimary || event.button !== 0) return;
      if ((event.target as Element).closest("button, a, input, select, textarea")) return;
      const offset = currentOffset(el);
      drag.current = {
        id: event.pointerId,
        originY: event.clientY - offset,
        startY: event.clientY,
        height: el.offsetHeight,
        active: false,
        lastY: event.clientY,
        lastT: event.timeStamp,
        velocity: 0,
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      const el = sheet.current;
      if (!d || !el || event.pointerId !== d.id) return;
      if (!d.active) {
        if (Math.abs(event.clientY - d.startY) < SLOP) return;
        d.active = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Zeiger schon weg – dann eben ohne Festhalten
        }
        el.style.transition = "none";
      }
      const y = Math.max(0, event.clientY - d.originY);
      el.style.transform = y > 0 ? `translate3d(0, ${y}px, 0)` : "";
      const dt = event.timeStamp - d.lastT;
      if (dt > 0) d.velocity = 0.8 * ((event.clientY - d.lastY) / dt) + 0.2 * d.velocity;
      d.lastY = event.clientY;
      d.lastT = event.timeStamp;
    },
    [],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || event.pointerId !== d.id) return;
      drag.current = null;
      if (!d.active) return;
      const y = Math.max(0, event.clientY - d.originY);
      // Ein Finger, der zuletzt stillstand, wirft nicht
      const flick = event.timeStamp - d.lastT < 100 && d.velocity > FLICK_VELOCITY && y > 24;
      // Schließen: Die Fläche bleibt, wo sie ist – der Austritt fährt von dort weiter
      if (y > Math.min(CLOSE_DISTANCE, d.height * 0.25) || flick) closeRef.current();
      else reset();
    },
    [reset],
  );

  const onPointerCancel = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (d?.active) reset();
  }, [reset]);

  return { ref: sheet, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }, reset };
}
