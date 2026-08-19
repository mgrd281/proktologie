"use client";

import { CINEMA_PANELS } from "@/content/cinema";
import {
  DESKTOP,
  MOBILE,
  PANEL_COUNT,
  corridorTime,
  panelState,
  type CorridorGeometry,
} from "@/lib/cinema/leistungen";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Zustand 03 – der Leistungs-Korridor.
 *
 * Die acht Leistungen schweben als Tafeln in der Tiefe rechts der
 * Textspalte; die Kamerafahrt (lokaler Fortschritt) zieht durch vier
 * Stationen zu je zwei Tafeln. Die gesamte Geometrie rechnet
 * lib/cinema/leistungen.ts – diese Komponente ist eine reine Senke:
 * Die MasterSequence ruft `render(local, weight, pointer)`, geschrieben
 * werden ausschließlich transform, opacity und ein diskretes data-blur.
 *
 * Der Körper ist aria-hidden: Dieselben acht Leistungen stehen als
 * vollständige, zugängliche Sektion weiter unten auf der Seite – hier
 * sind sie die räumliche Ouvertüre, nicht die Quelle.
 */

export interface LeistungenLayerHandle {
  render: (local: number, weight: number, pointer: { x: number; y: number }) => void;
}

export const LeistungenLayer = forwardRef<LeistungenLayerHandle>(
  function LeistungenLayer(_, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
    const teaserRefs = useRef<(HTMLParagraphElement | null)[]>([]);
    const geoRef = useRef<CorridorGeometry>(DESKTOP);
    const sizeRef = useRef({ w: 1440, h: 900 });
    const lastShown = useRef<number[]>(new Array(PANEL_COUNT).fill(-1));
    const lastWeight = useRef(-1);

    useEffect(() => {
      const media = window.matchMedia("(max-width: 767px)");
      const apply = () => {
        geoRef.current = media.matches ? MOBILE : DESKTOP;
        lastShown.current.fill(-1);
      };
      apply();
      const measure = () => {
        const root = rootRef.current;
        if (!root) return;
        sizeRef.current = { w: root.clientWidth || 1, h: root.clientHeight || 1 };
        lastShown.current.fill(-1);
      };
      measure();
      media.addEventListener("change", apply);
      window.addEventListener("resize", measure, { passive: true });
      return () => {
        media.removeEventListener("change", apply);
        window.removeEventListener("resize", measure);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      render(local, weight, pointer) {
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
          root.style.opacity = Math.pow(weight, 1.5).toFixed(3);
          root.style.visibility = "visible";
        }

        const t = corridorTime(local);
        const geo = geoRef.current;
        const { w, h } = sizeRef.current;
        const mobile = geo.perspective <= 0;

        for (let i = 0; i < PANEL_COUNT; i++) {
          const el = panelRefs.current[i];
          if (!el) continue;
          const st = panelState(i, t, geo);

          // Unsichtbar und war unsichtbar → nichts schreiben
          if (st.opacity <= 0.004 && lastShown.current[i] === 0) continue;
          lastShown.current[i] = st.opacity <= 0.004 ? 0 : 1;

          const px = st.x * w + (mobile ? 0 : pointer.x * 6);
          const py = st.y * h + (mobile ? 0 : pointer.y * 4);
          el.style.transform =
            `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) ` +
            `translate(-50%, -50%) scale(${st.scale.toFixed(3)})`;
          el.style.opacity = st.opacity.toFixed(3);
          el.style.visibility = st.opacity <= 0.004 ? "hidden" : "visible";

          const blur = String(st.blurStep);
          if (el.dataset.blur !== blur) el.dataset.blur = blur;

          // Teaser nur im Fokus lesbar – die Tiefe bleibt ruhig
          const teaser = teaserRefs.current[i];
          if (teaser) {
            const shown = st.focus < 0.15 ? 0 : st.focus;
            teaser.style.opacity = shown.toFixed(3);
          }
        }
      },
    }));

    return (
      <div
        ref={rootRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        {CINEMA_PANELS.map((panel, i) => (
          <div
            key={panel.title}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            data-blur="0"
            className="cinema-panel absolute top-0 left-0 w-[17rem] rounded-xl p-5 md:w-[19rem]"
            style={{ opacity: 0, visibility: "hidden" }}
          >
            <p className="flex items-baseline gap-3">
              <span className="font-display text-sm text-accent tabular-nums">
                {panel.number}
              </span>
              <span className="font-display text-xl leading-tight font-medium text-cream md:text-[1.35rem]">
                {panel.title}
              </span>
            </p>
            <p
              ref={(el) => {
                teaserRefs.current[i] = el;
              }}
              className="mt-2.5 hidden text-[13px] leading-relaxed text-cream/75 md:block"
              style={{ opacity: 0 }}
            >
              {panel.teaser}
            </p>
            <span aria-hidden="true" className="cinema-panel-veil" />
          </div>
        ))}
      </div>
    );
  },
);
