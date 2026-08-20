"use client";

import { SCENES, TOTAL_FRAMES } from "@/lib/cinema/frames";
import { forwardRef, useImperativeHandle, useRef } from "react";

/**
 * Der globale Frame-Zähler – dauerhaft sichtbares Gestaltungselement
 * (TPL-Referenz, vom Praxisinhaber so entschieden):
 *
 *     FRAME 0173 / 0500 · LEISTUNGEN
 *
 * Er macht sichtbar, dass die ganze Startseite EIN scrubbares Filmwerk
 * ist: vorwärts scrollen zählt vor, rückwärts scrollen zählt zurück.
 * Geschrieben wird per direkter textContent-Mutation und nur bei
 * Ganzzahl-/Szenenwechsel – kein React-Render pro Frame.
 */

export interface FrameCounterHandle {
  set(frame: number, sceneIndex: number): void;
}

const TOTAL = String(TOTAL_FRAMES).padStart(4, "0");

export const FrameCounter = forwardRef<FrameCounterHandle>(
  function FrameCounter(_, ref) {
    const frameRef = useRef<HTMLSpanElement>(null);
    const sceneRef = useRef<HTMLSpanElement>(null);
    const lastFrame = useRef(-1);
    const lastScene = useRef(-1);

    useImperativeHandle(ref, () => ({
      set(frame, sceneIndex) {
        const whole = Math.round(frame);
        if (whole !== lastFrame.current && frameRef.current) {
          lastFrame.current = whole;
          frameRef.current.textContent = `FRAME ${String(whole).padStart(4, "0")} / ${TOTAL}`;
        }
        if (sceneIndex !== lastScene.current && sceneRef.current) {
          lastScene.current = sceneIndex;
          sceneRef.current.textContent = SCENES[sceneIndex]?.label.toUpperCase() ?? "";
        }
      },
    }));

    return (
      <p
        aria-hidden="true"
        className="cinema-frame-counter pointer-events-none absolute bottom-9 left-1/2 hidden -translate-x-1/2 items-center gap-3 font-mono text-[10px] tracking-[0.22em] text-cream/55 tabular-nums md:flex"
      >
        <span ref={frameRef}>FRAME 0001 / {TOTAL}</span>
        <span aria-hidden="true" className="h-px w-6 bg-cream/25" />
        <span ref={sceneRef}>{SCENES[0].label.toUpperCase()}</span>
      </p>
    );
  },
);
