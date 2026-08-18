"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { cn } from "@/lib/cn";
import {
  FRAME_COUNT,
  LERP_FACTOR,
} from "@/components/hero/sequence/config";
import { FrameStore } from "@/components/hero/sequence/frameStore";

/**
 * Scroll-gescrubbte Canvas-Bildsequenz:
 * Scroll → Lenis → normalisierter Fortschritt (setProgress) →
 * LERP-Interpolation im eigenen rAF-Loop → Canvas zeichnet den Frame.
 *
 * – Der Fortschritt kommt von außen (HeroCinematic/useScrollProgress);
 *   hier läuft nur die Glättung (current += (target − current) · LERP)
 *   und das Zeichnen.
 * – Ist der exakt angeforderte Frame noch nicht dekodiert, zeichnet der
 *   Loop den nächstgelegenen verfügbaren (FrameStore.nearest).
 * – Cover-Verhalten bei jedem Viewport-Verhältnis, DPR-korrekt (Cap 2).
 * – Initialisiert sich nur auf Desktop ohne prefers-reduced-motion;
 *   der FRAME-Indikator wird per DOM-Mutation aktualisiert (keine
 *   React-Renders pro Frame).
 */

export interface CanvasSequenceHandle {
  /** Normalisierter Scroll-Fortschritt 0–1 → Ziel-Frame 1–FRAME_COUNT. */
  setProgress(progress: number): void;
}

interface CanvasSequenceProps {
  className?: string;
  /** Element, dessen textContent mit „FRAME 0001 / 0500" befüllt wird. */
  frameIndicatorRef?: RefObject<HTMLElement | null>;
}

export const CanvasSequence = forwardRef<
  CanvasSequenceHandle,
  CanvasSequenceProps
>(function CanvasSequence({ className, frameIndicatorRef }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeRef = useRef<FrameStore | null>(null);
  const playheadRef = useRef({ target: 1, current: 1 });
  const [firstFrameDrawn, setFirstFrameDrawn] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      setProgress(progress: number) {
        const clamped = Math.min(1, Math.max(0, progress));
        const state = playheadRef.current;
        const next = 1 + clamped * (FRAME_COUNT - 1);
        const direction: 1 | -1 = next >= state.target ? 1 : -1;
        state.target = next;
        storeRef.current?.setPlayhead(Math.round(next), direction);
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const desktop = window.matchMedia("(min-width: 1024px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let store: FrameStore | null = null;
    let rafId = 0;
    let observer: ResizeObserver | null = null;
    let lastDrawnBitmap: ImageBitmap | null = null;
    let lastIndicatorFrame = -1;

    const teardown = () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      observer = null;
      store?.destroy();
      store = null;
      storeRef.current = null;
      lastDrawnBitmap = null;
    };

    const setup = () => {
      if (store || !desktop.matches || reduced.matches) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      store = new FrameStore();
      storeRef.current = store;
      store.start();
      store.setPlayhead(Math.round(playheadRef.current.target), 1);

      const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const { clientWidth, clientHeight } = canvas;
        if (!clientWidth || !clientHeight) return;
        canvas.width = Math.round(clientWidth * dpr);
        canvas.height = Math.round(clientHeight * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        lastDrawnBitmap = null; // Neuzeichnen erzwingen
      };
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      const draw = (bitmap: ImageBitmap) => {
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        if (!cw || !ch) return;
        // Cover: kürzere Seite füllt, zentriert beschnitten
        const scale = Math.max(cw / bitmap.width, ch / bitmap.height);
        const dw = bitmap.width * scale;
        const dh = bitmap.height * scale;
        context.drawImage(bitmap, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      };

      const tick = () => {
        rafId = requestAnimationFrame(tick);
        const state = playheadRef.current;
        state.current += (state.target - state.current) * LERP_FACTOR;
        if (Math.abs(state.target - state.current) < 0.02) {
          state.current = state.target;
        }
        const frame = Math.round(
          Math.min(FRAME_COUNT, Math.max(1, state.current)),
        );

        const bitmap = store?.nearest(frame) ?? null;
        if (bitmap && bitmap !== lastDrawnBitmap) {
          draw(bitmap);
          lastDrawnBitmap = bitmap;
          setFirstFrameDrawn(true);
        }

        if (frame !== lastIndicatorFrame && frameIndicatorRef?.current) {
          lastIndicatorFrame = frame;
          frameIndicatorRef.current.textContent = `FRAME ${String(frame).padStart(4, "0")} / ${String(FRAME_COUNT).padStart(4, "0")}`;
        }
      };
      rafId = requestAnimationFrame(tick);
    };

    const onChange = () => {
      if (desktop.matches && !reduced.matches) setup();
      else teardown();
    };
    onChange();
    desktop.addEventListener("change", onChange);
    reduced.addEventListener("change", onChange);

    return () => {
      desktop.removeEventListener("change", onChange);
      reduced.removeEventListener("change", onChange);
      teardown();
    };
  }, [frameIndicatorRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "transition-opacity duration-700",
        firstFrameDrawn ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
});
