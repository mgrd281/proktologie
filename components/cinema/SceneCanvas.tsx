"use client";

import { camAt, sourceRectFor, STILL_DPR_CAP, type Cam } from "@/lib/cinema/camera";
import { SOURCES, type FramesSource, type StillSource } from "@/lib/cinema/sources";
import {
  DEFAULT_STORE_CONFIG,
  FrameStore,
} from "@/components/hero/sequence/frameStore";
import { cn } from "@/lib/cn";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Der Compositor des Filmwerks: EIN Canvas zeichnet pro Frame alle
 * aktiven Szenen-Quellen (höchstens zwei, node-getestet) übereinander –
 * Frame-Sequenzen über den FrameStore, Stills über das Kamera-
 * Quellrechteck aus lib/cinema/camera.ts, Kreuzblenden über globalAlpha.
 *
 * Reine Senke wie TeamStage: kein eigener rAF, kein eigener LERP – die
 * MasterSequence ruft `render(currentFrame, pointer)` aus dem EINEN Loop.
 * Dadurch ist jeder gezeichnete Frame eine zustandslose Funktion des
 * Master-Frames, und Rückwärts-Scrollen malt den Film exakt rückwärts.
 *
 * – DPR-bewusst (Deckel 1.5: die Quellen sind 960–1600 px breit; mehr
 *   Backing-Store hieße nur mehr Hochskalierung und Füllrate).
 * – Der gebackene Film liegt in zwei Fassungen vor: Geräte < 768 px
 *   laden die 250er-Mobilsequenz, alle anderen die 500er-Desktopsequenz
 *   (Auswahl über source.media). Reduzierte Bewegung lädt KEINE Sequenz –
 *   die ruhige Fassung tragen Poster + DOM-Umgebungen.
 * – Ferne Sequenz-Quellen pausieren (Fenster leeren, Leiter behalten);
 *   `setActive(false)` stoppt alles, wenn die Fahrt außer Sicht ist.
 */

export interface SceneCanvasHandle {
  render(frame: number, pointer: { x: number; y: number }): void;
  /** Preload/Decode an- oder abschalten (Fahrt außer Sicht). */
  setActive(active: boolean): void;
}

interface StillState {
  source: StillSource;
  sharp: ImageBitmap | null;
  soft: ImageBitmap | null;
}

interface FramesState {
  source: FramesSource;
  store: FrameStore;
}

/** Master-Frame → lokaler Sequenz-Frame über die Quell-Spanne. */
function localFrame(source: FramesSource, f: number): number {
  const [a, b] = source.span;
  const t = Math.min(1, Math.max(0, (f - a) / (b - a)));
  return Math.max(1, Math.min(source.count, Math.round(1 + t * (source.count - 1))));
}

export const SceneCanvas = forwardRef<
  SceneCanvasHandle,
  {
    className?: string;
    /**
     * Wird gerufen, sobald neues Material zeichenbar ist. Nötig, weil der
     * eine rAF-Loop in MasterSequence aussteigt, sobald die Fahrt ruht:
     * Ohne dieses Signal bliebe das Canvas beim Erstaufruf leer, bis der
     * Besucher scrollt – die Startseite zeigte dann nur den Verlauf.
     */
    onContentReady?: () => void;
  }
>(function SceneCanvas({ className, onContentReady }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const readyRef = useRef(onContentReady);
    readyRef.current = onContentReady;
    const stillsRef = useRef<StillState[]>([]);
    const framesRef = useRef<FramesState[]>([]);
    const activeRef = useRef(true);
    const lastSigRef = useRef("");
    const lastFrameRef = useRef(1);
    const dirtyRef = useRef(true);
    const [firstDrawn, setFirstDrawn] = useState(false);
    const firstDrawnRef = useRef(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const mobileAssets = window.matchMedia("(max-width: 767px)");

      let disposed = false;

      const resize = () => {
        const dpr = Math.min(STILL_DPR_CAP, window.devicePixelRatio || 1);
        const { clientWidth, clientHeight } = canvas;
        if (!clientWidth || !clientHeight) return;
        canvas.width = Math.round(clientWidth * dpr);
        canvas.height = Math.round(clientHeight * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        lastSigRef.current = "";
        dirtyRef.current = true;
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      // ---- Stills laden (auch mobil – Static-Cinematic-Modus) ----
      const loadStill = async (state: StillState) => {
        const mobile = mobileAssets.matches;
        const src = mobile ? state.source.srcMobile : state.source.src;
        const softSrc = mobile ? state.source.softMobile : state.source.soft;
        try {
          const blob = await (await fetch(src)).blob();
          if (disposed) return;
          state.sharp = await createImageBitmap(blob);
          dirtyRef.current = true;
          readyRef.current?.();
        } catch {
          /* Quelle bleibt leer – die DOM-Umgebungen tragen weiter */
        }
        if (softSrc) {
          try {
            const blob = await (await fetch(softSrc)).blob();
            if (disposed) return;
            state.soft = await createImageBitmap(blob);
            dirtyRef.current = true;
            readyRef.current?.();
          } catch {
            /* weiche Ebene optional */
          }
        }
      };

      stillsRef.current = SOURCES.filter(
        (s): s is StillSource => s.mode === "still",
      ).map((source) => ({ source, sharp: null, soft: null }));
      stillsRef.current.forEach((s) => void loadStill(s));

      // ---- Film-Sequenz nach Geräteklasse; reduzierte Bewegung: keine ----
      const teardownFrames = () => {
        framesRef.current.forEach((f) => f.store.destroy());
        framesRef.current = [];
      };
      const setupFrames = () => {
        const wanted = reduced.matches
          ? null
          : mobileAssets.matches
            ? "mobile"
            : "desktop";
        const current =
          framesRef.current.length > 0 ? framesRef.current[0].source.media : null;
        if (wanted === current) return;
        teardownFrames();
        if (wanted === null) return;
        framesRef.current = SOURCES.filter(
          (s): s is FramesSource => s.mode === "frames" && s.media === wanted,
        ).map((source) => {
          const store = new FrameStore({
            ...DEFAULT_STORE_CONFIG,
            ...source.store,
            windowCapacity: source.store.windowRadius * 2 + 16,
            count: source.count,
            path: source.path,
          });
          store.onFrameReady = () => {
            dirtyRef.current = true;
            readyRef.current?.();
          };
          store.start();
          store.setPlayhead(localFrame(source, lastFrameRef.current), 1);
          return { source, store };
        });
      };
      setupFrames();
      mobileAssets.addEventListener("change", setupFrames);
      reduced.addEventListener("change", setupFrames);

      return () => {
        disposed = true;
        observer.disconnect();
        mobileAssets.removeEventListener("change", setupFrames);
        reduced.removeEventListener("change", setupFrames);
        teardownFrames();
        stillsRef.current.forEach((s) => {
          s.sharp?.close();
          s.soft?.close();
        });
        stillsRef.current = [];
      };
    }, []);

    useImperativeHandle(ref, () => ({
      setActive(active: boolean) {
        activeRef.current = active;
        framesRef.current.forEach((f) => (active ? f.store.resume() : f.store.pause()));
      },

      render(frame, pointer) {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || !activeRef.current) return;

        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        if (!cw || !ch) return;

        // Playheads + Pausen der Sequenz-Quellen nachführen
        // (Richtung ZUERST bestimmen – sie steuert die Decode-Priorität)
        const direction: 1 | -1 = frame >= lastFrameRef.current ? 1 : -1;
        lastFrameRef.current = frame;
        for (const fs of framesRef.current) {
          const [a, b] = fs.source.span;
          const sceneSpan = (b - a) * 1.5;
          if (frame > b + sceneSpan * 0.5 || frame < a - sceneSpan * 0.5) {
            fs.store.pause();
          } else {
            fs.store.resume();
            fs.store.setPlayhead(localFrame(fs.source, frame), direction);
          }
        }

        /*
         * Nur zeichnen, wenn sich am Ergebnis etwas ändert: Der Frame ist
         * auf 0.2 quantisiert (2 vh Scroll), dazu die Alphas – während des
         * Lenis-Ausklangs teilen sich viele Ticks dieselbe Signatur.
         */
        const q = Math.round(frame * 5) / 5;
        let sig = `${q}|${pointer.x.toFixed(2)}`;
        const alphas: number[] = [];
        for (const src of SOURCES) {
          const a = src.alpha(frame);
          alphas.push(a);
          sig += `|${a.toFixed(3)}`;
        }
        if (sig === lastSigRef.current && !dirtyRef.current) return;
        lastSigRef.current = sig;
        dirtyRef.current = false;

        context.clearRect(0, 0, cw, ch);
        let drew = false;

        SOURCES.forEach((source, i) => {
          const alpha = alphas[i];
          if (alpha <= 0.004) return;
          // Gamma gegen die Geisterphase – wie bei den DOM-Ebenen
          context.globalAlpha = Math.pow(alpha, 1.5);

          if (source.mode === "frames") {
            const fs = framesRef.current.find((f) => f.source === source);
            const bitmap = fs?.store.nearest(localFrame(source, frame)) ?? null;
            if (!bitmap) return;
            // Cover: kürzere Seite füllt, zentriert beschnitten
            const scale = Math.max(cw / bitmap.width, ch / bitmap.height);
            const dw = bitmap.width * scale;
            const dh = bitmap.height * scale;
            context.drawImage(bitmap, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
            drew = true;
            return;
          }

          const still = stillsRef.current.find((s) => s.source === source);
          if (!still?.sharp && !still?.soft) return;
          const cam = camAt(source.camera, frame);

          /*
           * Tiefe im Still: Die weiche Rückwand (Blur steckt IM Asset)
           * fährt mit gedämpfter Kamera, die scharfe Ebene voll plus
           * Zeiger-Parallaxe – zwei Draws derselben Fahrt.
           */
          if (still.soft) {
            const softCam: Cam = {
              x: 0.5 + (cam.x - 0.5) * 0.5,
              y: 0.5 + (cam.y - 0.5) * 0.5,
              zoom: 1 + (cam.zoom - 1) * 0.5,
            };
            const r = sourceRectFor(softCam, source.srcW, source.srcH, cw, ch);
            context.drawImage(still.soft, r.sx, r.sy, r.sw, r.sh, 0, 0, cw, ch);
            drew = true;
          }
          if (still.sharp) {
            const r = sourceRectFor(cam, source.srcW, source.srcH, cw, ch);
            const shift = pointer.x * -source.pointerShift;
            context.drawImage(
              still.sharp,
              r.sx,
              r.sy,
              r.sw,
              r.sh,
              shift,
              0,
              cw,
              ch,
            );
            drew = true;
          }
        });
        context.globalAlpha = 1;

        if (drew && !firstDrawnRef.current) {
          firstDrawnRef.current = true;
          setFirstDrawn(true);
        }

        // Probe-Fläche für die Browser-Tests (zero-alloc, wertbasiert)
        const w = window as unknown as {
          __cinema?: { lastDrawSig?: string; draws?: number };
        };
        if (w.__cinema) {
          w.__cinema.lastDrawSig = sig;
          w.__cinema.draws = (w.__cinema.draws ?? 0) + (drew ? 1 : 0);
        }
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn(
          "transition-opacity duration-700",
          firstDrawn ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    );
  },
);
