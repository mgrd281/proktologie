"use client";

import { CINEMA_SYMPTOME } from "@/content/cinema";
import { cycleWeight } from "@/lib/cinema/timeline";
import { forwardRef, useImperativeHandle, useRef } from "react";

/**
 * Zustand 04 – der Symptom-Zyklus.
 *
 * Rechts der Textspalte wechseln die vier Beschwerde-Cluster als große,
 * ruhige Typografie durch: Das Symptom als Anzeige-Zeile, darunter die
 * Einordnung. Der Wechsel ist eine Überblendung (cycleWeight aus der
 * Zeitachse), keine Abfolge von Schnitten – ein Cluster ist noch da,
 * während der nächste kommt.
 *
 * Reine Senke; der Körper ist aria-hidden, denn dieselben Cluster stehen
 * als vollständige, zugängliche Sektion weiter unten auf der Seite.
 */

export interface SymptomeLayerHandle {
  render: (local: number, weight: number) => void;
}

const COUNT = CINEMA_SYMPTOME.length;
/** Blende zwischen den Fenstern des Zyklus – knapp, damit die Haltephase trägt. */
const CYCLE_OVERLAP = 0.06;

export const SymptomeLayer = forwardRef<SymptomeLayerHandle>(
  function SymptomeLayer(_, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const lastShown = useRef<number[]>(new Array(COUNT).fill(-1));
    const lastWeight = useRef(-1);

    useImperativeHandle(ref, () => ({
      render(local, weight) {
        const root = rootRef.current;
        if (!root) return;

        if (weight <= 0.004) {
          if (lastWeight.current !== 0) {
            lastWeight.current = 0;
            root.style.opacity = "0";
            root.style.visibility = "hidden";
          }
          return;
        }
        if (lastWeight.current !== weight) {
          lastWeight.current = weight;
          /*
           * Gamma auf der Ebenen-Blende: Weiße Schrift liest sich schon bei
           * 12 % Deckkraft – ohne Kurve stünde die Ebene als Geisterschrift
           * unter dem nächsten Zustand, statt leise auszuklingen.
           */
          root.style.opacity = Math.pow(weight, 1.4).toFixed(3);
          root.style.visibility = "visible";
        }

        for (let i = 0; i < COUNT; i++) {
          const el = itemRefs.current[i];
          if (!el) continue;
          const w = cycleWeight(local, i, COUNT, CYCLE_OVERLAP);
          if (w <= 0.004 && lastShown.current[i] === 0) continue;
          lastShown.current[i] = w <= 0.004 ? 0 : 1;

          /*
           * Wie bei den Zustandstexten: Gamma drückt die Geisterphase weg,
           * die Bewegung zieht von unten nach oben durch das Fenster.
           */
          const shown = w < 0.12 ? 0 : Math.pow(w, 2);
          el.style.opacity = shown.toFixed(3);
          el.style.visibility = shown <= 0.004 ? "hidden" : "visible";
          const mid = (i + 0.5) / COUNT;
          el.style.transform = `translate3d(0, ${((mid - local) * 190).toFixed(1)}px, 0)`;
        }
      },
    }));

    return (
      <div
        ref={rootRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] md:block"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        {CINEMA_SYMPTOME.map((cluster, i) => (
          <div
            key={cluster.symptom}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 pr-10 lg:pr-24"
            style={{ opacity: 0, visibility: "hidden" }}
          >
            <p className="flex items-center gap-4 text-xs font-semibold tracking-[0.22em] text-accent/90 uppercase">
              <span className="h-px w-10 bg-accent/45" />
              {String(i + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
            </p>
            <p className="font-display mt-4 max-w-md text-3xl leading-[1.12] font-medium text-cream lg:text-[2.5rem]">
              {cluster.symptom}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/70">
              {cluster.text}
            </p>
            <p className="mt-3 flex max-w-sm items-start gap-2.5 text-[13px] leading-relaxed text-cream/85">
              <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
              {cluster.advice}
            </p>
          </div>
        ))}
      </div>
    );
  },
);
