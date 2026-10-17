"use client";

import { cn } from "@/lib/cn";
import {
  AnimatePresence,
  LazyMotion,
  m,
  useIsPresent,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";

/**
 * Bewegung der Buchungsschritte (Motion, MOTION_SYSTEM.md):
 * – „Weiter" schiebt den neuen Schritt von rechts herein und den alten nach
 *   links hinaus, „Zurück" umgekehrt – 24 px, 280 ms herein / 180 ms hinaus.
 * – Die Karte wächst und schrumpft mit (Höhe, 280 ms), damit der Inhalt
 *   darunter gleitet statt zu springen. Bewusst Höhe statt FLIP-Layout:
 *   Bei FLIP stünde der Inhalt unter der Karte sofort am neuen Platz.
 * – Reduzierte Bewegung: sofortiger Wechsel, keine Höhenfahrt.
 * Im statischen HTML ist nichts versteckt (initial={false}) – ohne
 * JavaScript bleibt der erste Schritt sichtbar.
 *
 * Import aus „framer-motion" (= Motion für React): Der Sammel-Import
 * „motion/react" zieht die ganze Bibliothek in die Startseite (+45 KB gzip),
 * dieser nur, was hier gebraucht wird (+17 KB, Animationsteil nachgeladen).
 */

const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] as const;
const SHIFT = 24;

const loadFeatures = () => import("@/lib/motionFeatures").then((mod) => mod.default);

const paneVariants: Variants = {
  enter: ({ direction, reduced }: PaneCustom) =>
    reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * SHIFT },
  center: ({ reduced }: PaneCustom) => ({
    opacity: 1,
    x: 0,
    transition: { duration: reduced ? 0 : 0.28, ease: EASE_OUT_SOFT },
  }),
  exit: ({ direction, reduced }: PaneCustom) => ({
    opacity: 0,
    x: reduced ? 0 : -direction * SHIFT,
    transition: { duration: reduced ? 0 : 0.18, ease: EASE_OUT_SOFT },
  }),
};

interface PaneCustom {
  direction: number;
  reduced: boolean;
}

/**
 * Ein Schritt. Während er hinausgleitet, ist er `inert`: nicht mehr
 * antippbar, nicht fokussierbar und für Screenreader verschwunden.
 */
function Pane({ ref, custom, children }: { ref?: Ref<HTMLDivElement>; custom: PaneCustom; children: ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <m.div
      ref={ref}
      inert={!isPresent}
      custom={custom}
      variants={paneVariants}
      initial="enter"
      animate="center"
      exit="exit"
    >
      {children}
    </m.div>
  );
}

interface StepFrameProps {
  /** Wechselt der Schlüssel, gleitet der neue Inhalt herein. */
  paneKey: string | number;
  /** +1 = vorwärts, −1 = zurück */
  direction: number;
  /** Innenabstand des Kartenkörpers */
  className?: string;
  children: ReactNode;
}

export function StepFrame({ paneKey, direction, className, children }: StepFrameProps) {
  const reduced = useReducedMotion() ?? false;
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const custom: PaneCustom = { direction, reduced };

  return (
    <LazyMotion features={loadFeatures} strict>
      <m.div
        initial={false}
        animate={{ height }}
        transition={{ duration: reduced ? 0 : 0.28, ease: EASE_OUT_SOFT }}
        style={{ overflow: "hidden" }}
      >
        {/* relative: Bezugsrahmen für den hinausgleitenden Schritt (popLayout).
            Deckender Hintergrund hinter dem Inhalt, sonst glättet Chrome den Text
            dieser Ebene nur in Graustufen (Windows: sichtbar weicher). Nur die
            Inhaltsfläche – die runden Kartenecken bleiben unberührt. */}
        <div ref={inner} className={cn("relative bg-white bg-clip-content", className)}>
          <AnimatePresence mode="popLayout" initial={false} custom={custom}>
            <Pane key={paneKey} custom={custom}>
              {children}
            </Pane>
          </AnimatePresence>
        </div>
      </m.div>
    </LazyMotion>
  );
}
