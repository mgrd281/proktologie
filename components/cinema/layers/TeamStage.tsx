"use client";

import { TeamCard } from "@/components/team/TeamCard";
import { team, teamOutro } from "@/content/team";
import {
  DESKTOP,
  MOBILE,
  MEMBER_COUNT,
  T_MAX,
  cardFootPoint,
  cardState,
  chapterAt,
  project,
  smoothstep,
  type SceneGeometry,
} from "@/lib/team/scene";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";

/**
 * Die sechs Porträt-Ebenen als EBENE der großen Kamerafahrt.
 *
 * Früher besaß diese Szene einen eigenen Scroll-Track, einen eigenen
 * rAF-Loop und eine eigene Interpolation. Beides gehört jetzt der
 * MasterSequence: Hier bleibt eine reine Senke, die auf Zuruf zeichnet.
 * Dadurch laufen Team und die übrigen Zustände auf EINER Zeitachse – die
 * Porträts können erscheinen, bevor „Behandlung" zu Ende ist, und in die
 * Tiefe zurückweichen, während der Empfang schon da ist.
 *
 * Die Geometrie selbst liegt unverändert in lib/team/scene.ts (browserfrei
 * getestet); hier steht nur, wie sie auf die Ebenen geschrieben wird.
 */

export interface TeamStageHandle {
  /**
   * @param local   Fortschritt 0–1 innerhalb des Team-Zustands
   * @param weight  Sichtbarkeit der ganzen Ebene (Überblendung, 0–1)
   * @param pointer geglättete Zeigerposition (−1 … 1) für die Parallaxe
   */
  render(local: number, weight: number, pointer: { x: number; y: number }): void;
}

interface TeamStageProps {
  /** Meldet den Wechsel des Unter-Kapitels (01/06 … 06/06). */
  onChapter?: (chapter: number) => void;
  children?: ReactNode;
}

export const TeamStage = forwardRef<TeamStageHandle, TeamStageProps>(
  function TeamStage({ onChapter }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<HTMLDivElement>(null);
    const planesRef = useRef<HTMLLIElement[]>([]);
    const pathRef = useRef<SVGPathElement>(null);
    const pathGlowRef = useRef<SVGPathElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const outroRef = useRef<HTMLDivElement>(null);

    const geoRef = useRef<SceneGeometry>(DESKTOP);
    const sizeRef = useRef({ w: 1440, h: 900 });
    const blurRef = useRef<number[]>([]);
    const chapterRef = useRef(-1);

    // Maße folgen dem Viewport – gemessen bei Mount und Resize, nie pro Bild.
    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      const measure = () => {
        const isMobile = window.matchMedia("(max-width: 1023px)").matches;
        const geo = isMobile ? MOBILE : DESKTOP;
        geoRef.current = geo;
        const rect = root.getBoundingClientRect();
        sizeRef.current = { w: rect.width, h: rect.height };
        root.style.setProperty("--plane-w", `${geo.cardWidth}px`);
        root.style.setProperty("--stage-perspective", `${geo.perspective}px`);
        svgRef.current?.setAttribute(
          "viewBox",
          `${-rect.width / 2} ${-rect.height / 2} ${rect.width} ${rect.height}`,
        );
      };
      measure();
      window.addEventListener("resize", measure, { passive: true });
      return () => window.removeEventListener("resize", measure);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        render(local, weight, pointer) {
          const root = rootRef.current;
          if (!root) return;

          // Ganze Ebene aus- bzw. einblenden (Überblendung mit Nachbarszenen)
          root.style.opacity = weight.toFixed(3);
          root.style.visibility = weight <= 0.004 ? "hidden" : "visible";
          if (weight <= 0.004) return;

          const t = local * T_MAX;
          const geo = geoRef.current;
          const { w } = sizeRef.current;
          const active = Math.min(
            MEMBER_COUNT - 1,
            Math.max(0, Math.round(t) - 1),
          );
          const groupBlend = smoothstep(MEMBER_COUNT, T_MAX, t);

          const nodes: { x: number; y: number }[] = [];
          for (let i = 0; i < MEMBER_COUNT; i++) {
            const el = planesRef.current[i];
            if (!el) continue;
            const s = cardState(i, t, geo, sizeRef.current);

            const isActive = i === active && groupBlend < 0.5;
            const yaw = s.rotateY + (isActive ? pointer.x * 2.5 : 0);
            const pitch = s.rotateX + (isActive ? -pointer.y * 1.5 : 0);

            el.style.transform =
              `translate3d(calc(-50% + ${s.x.toFixed(1)}px), calc(-50% + ${s.y.toFixed(1)}px), ${s.z.toFixed(1)}px) ` +
              `rotateY(${yaw.toFixed(2)}deg) rotateX(${pitch.toFixed(2)}deg)`;
            el.style.opacity = s.opacity.toFixed(3);
            el.style.visibility = s.opacity <= 0.004 ? "hidden" : "visible";

            if (blurRef.current[i] !== s.blurStep) {
              blurRef.current[i] = s.blurStep;
              el.dataset.blur = String(s.blurStep);
            }

            const foot = project(cardFootPoint(s, geo), geo);
            if (foot.visible && Math.abs(foot.x) < w * 0.8 && s.opacity > 0.2) {
              nodes.push(foot);
            }
          }

          // Lichtbahn am Boden – sie führt die grüne Linie der Fahrt weiter
          let d = "";
          if (nodes.length > 1) {
            d = `M${nodes[0].x.toFixed(1)} ${nodes[0].y.toFixed(1)}`;
            for (let n = 1; n < nodes.length; n++) {
              const prev = nodes[n - 1];
              const cur = nodes[n];
              d += `Q${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${((prev.x + cur.x) / 2).toFixed(1)} ${((prev.y + cur.y) / 2).toFixed(1)}`;
            }
            const last = nodes[nodes.length - 1];
            d += `L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
          }
          pathRef.current?.setAttribute("d", d);
          pathGlowRef.current?.setAttribute("d", d);

          if (outroRef.current) {
            const inn = smoothstep(MEMBER_COUNT + 0.35, T_MAX - 0.05, t);
            outroRef.current.style.opacity = inn.toFixed(3);
            outroRef.current.style.transform = `translate3d(0, ${((1 - inn) * 24).toFixed(1)}px, 0)`;
            outroRef.current.style.visibility = inn < 0.004 ? "hidden" : "visible";
          }

          const nextChapter = chapterAt(t);
          if (nextChapter !== chapterRef.current) {
            chapterRef.current = nextChapter;
            onChapter?.(nextChapter);
          }
        },
      }),
      [onChapter],
    );

    return (
      <div
        ref={rootRef}
        className="cinema-team absolute inset-0"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        <div
          ref={sceneRef}
          className="team-scene absolute inset-0"
          style={{ perspective: "var(--stage-perspective, 1400px)" }}
        >
          <svg
            ref={svgRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="-720 -450 1440 900"
            preserveAspectRatio="none"
          >
            <path
              ref={pathGlowRef}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.18"
              strokeWidth="6"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              ref={pathRef}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.7"
              strokeWidth="1.25"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Die Ebenen sind selbst die Listenpunkte (preserve-3d-Falle, siehe TeamCard) */}
          <ul className="absolute inset-0 list-none [transform-style:preserve-3d]">
            {team.map((member, index) => (
              <TeamCard
                key={member.id}
                ref={(el) => {
                  if (el) planesRef.current[index] = el;
                }}
                member={member}
                index={index}
                eager={index === 0}
              />
            ))}
          </ul>
        </div>

        {/* Schlusszeile des Team-Zustands – geht in den Empfang über */}
        <div
          ref={outroRef}
          className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-5 opacity-0 md:bottom-28"
          style={{ visibility: "hidden" }}
        >
          <p className="font-display rounded-full bg-cream/85 px-7 py-2.5 text-center text-xl font-medium text-ink shadow-[0_18px_40px_-24px_rgba(23,37,27,0.5)] md:text-2xl">
            {teamOutro.line}
          </p>
        </div>
      </div>
    );
  },
);
