"use client";

import { Button } from "@/components/ui/Button";
import { TeamCard } from "@/components/team/TeamCard";
import { TeamProgress } from "@/components/team/TeamProgress";
import { team, teamIntro, teamOutro } from "@/content/team";
import { useScrollProgress } from "@/lib/hooks/useScrollProgress";
import {
  DESKTOP,
  MOBILE,
  MEMBER_COUNT,
  T_MAX,
  cardState,
  chapterAt,
  clamp,
  progressForStop,
  project,
  smoothstep,
  type SceneGeometry,
} from "@/lib/team/scene";
import { useLenis } from "@/providers/LenisProvider";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Die Team-Szene: sechs Porträt-Ebenen auf einem Pfad, durch den eine
 * Kamera fährt. Der Scroll-Fortschritt steuert ausschließlich die Kamera –
 * die gesamte Geometrie liegt in lib/team/scene.ts und ist dort ohne
 * Browser getestet.
 *
 * Renderpfad: EIN requestAnimationFrame-Loop. Der Scroll liefert nur ein
 * Ziel, der Loop nähert sich ihm per LERP (0.1) – dadurch läuft die
 * Bewegung nach dem Radstopp weich aus (zusammen mit Lenis). Geschrieben
 * werden pro Frame nur transform/opacity (compositor-only) und ein einziges
 * SVG-`d`. React rendert ausschließlich beim Kapitelwechsel (max. 8×).
 */

/** Trägheit der Kamera. Kleiner = schwerer. */
const LERP = 0.1;
/** Unterhalb dieser Differenz gilt die Szene als ruhig – keine Schreibvorgänge. */
const EPSILON = 0.0002;

export function TeamScene() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);
  const planesRef = useRef<HTMLLIElement[]>([]);
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);
  const envSharpRef = useRef<HTMLDivElement>(null);

  const target = useRef(0);
  const current = useRef(0);
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const geoRef = useRef<SceneGeometry>(DESKTOP);
  const sizeRef = useRef({ w: 1440, h: 900 });
  const blurRef = useRef<number[]>([]);
  const dirty = useRef(true);
  const chapterRef = useRef(0);
  const [chapter, setChapter] = useState(0);
  const { scrollTo } = useLenis();

  useScrollProgress(trackRef, (p) => {
    target.current = p;
  });

  // Geometrie und Bühnenmaße folgen dem Viewport (Mobil ist eine eigene
  // Tabelle, kein geschrumpfter Desktop).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      const geo = isMobile ? MOBILE : DESKTOP;
      geoRef.current = geo;
      const rect = stage.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };
      stage.style.setProperty("--plane-w", `${geo.cardWidth}px`);
      stage.style.setProperty("--stage-perspective", `${geo.perspective}px`);
      svgRef.current?.setAttribute(
        "viewBox",
        `${-rect.width / 2} ${-rect.height / 2} ${rect.width} ${rect.height}`,
      );
      dirty.current = true;
    };

    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Zeiger-Parallaxe: nur Desktop, nur die aktive Ebene, sehr zurückhaltend.
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) return;
    const onMove = (event: PointerEvent) => {
      const { w, h } = sizeRef.current;
      pointer.current.x = clamp((event.clientX / w) * 2 - 1, -1, 1);
      pointer.current.y = clamp((event.clientY / h) * 2 - 1, -1, 1);
      dirty.current = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);

      const delta = target.current - current.current;
      const pdx = pointer.current.x - pointer.current.sx;
      const pdy = pointer.current.y - pointer.current.sy;
      const settled =
        Math.abs(delta) < EPSILON && Math.abs(pdx) < 0.001 && Math.abs(pdy) < 0.001;
      if (settled && !dirty.current) return;
      dirty.current = false;

      current.current += delta * LERP;
      pointer.current.sx += pdx * LERP;
      pointer.current.sy += pdy * LERP;

      const p = current.current;
      const t = p * T_MAX;
      const geo = geoRef.current;
      const { w } = sizeRef.current;
      const active = clamp(Math.round(t) - 1, 0, MEMBER_COUNT - 1);
      const groupBlend = smoothstep(MEMBER_COUNT, T_MAX, t);

      // Ebenen
      let d = "";
      const nodes: { x: number; y: number }[] = [];
      for (let i = 0; i < MEMBER_COUNT; i++) {
        const el = planesRef.current[i];
        if (!el) continue;
        const s = cardState(i, t, geo, sizeRef.current);

        // Zeiger-Parallaxe ausschließlich auf der aktiven Ebene
        const isActive = i === active && groupBlend < 0.5;
        const yaw = s.rotateY + (isActive ? pointer.current.sx * 2.5 : 0);
        const pitch = s.rotateX + (isActive ? -pointer.current.sy * 1.5 : 0);

        el.style.transform =
          `translate3d(calc(-50% + ${s.x.toFixed(1)}px), calc(-50% + ${s.y.toFixed(1)}px), ${s.z.toFixed(1)}px) ` +
          `rotateY(${yaw.toFixed(2)}deg) rotateX(${pitch.toFixed(2)}deg)`;
        el.style.opacity = s.opacity.toFixed(3);
        el.style.visibility = s.opacity <= 0.004 ? "hidden" : "visible";

        // Unschärfestufe nur bei Wechsel schreiben (kein Re-Raster pro Frame)
        if (blurRef.current[i] !== s.blurStep) {
          blurRef.current[i] = s.blurStep;
          el.dataset.blur = String(s.blurStep);
        }

        const point = project(s, geo);
        // Nur Knoten in Bildnähe verbinden – sonst zieht die Bahn quer
        // über den Schirm zu Ebenen, die längst außerhalb liegen.
        if (point.visible && Math.abs(point.x) < w * 0.75 && s.opacity > 0.1) {
          nodes.push(point);
        }
      }
      // Weiche Kurve durch die Knoten (quadratisch über die Mittelpunkte)
      if (nodes.length > 1) {
        d = `M${nodes[0].x.toFixed(1)} ${nodes[0].y.toFixed(1)}`;
        for (let n = 1; n < nodes.length; n++) {
          const prev = nodes[n - 1];
          const cur = nodes[n];
          const mx = (prev.x + cur.x) / 2;
          const my = (prev.y + cur.y) / 2;
          d += `Q${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
        }
        const last = nodes[nodes.length - 1];
        d += `L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
      }
      pathRef.current?.setAttribute("d", d);

      // Intro weicht zurück, statt zu verschwinden
      if (introRef.current) {
        const out = smoothstep(0.06, 0.95, t);
        introRef.current.style.opacity = (1 - out).toFixed(3);
        introRef.current.style.transform = `translate3d(0, ${(-out * 40).toFixed(1)}px, ${(-out * 320).toFixed(0)}px)`;
        introRef.current.style.visibility = out > 0.996 ? "hidden" : "visible";
      }

      // Finale: Schlusszeile + CTA
      if (outroRef.current) {
        const inn = smoothstep(MEMBER_COUNT + 0.35, T_MAX - 0.05, t);
        outroRef.current.style.opacity = inn.toFixed(3);
        outroRef.current.style.transform = `translate3d(0, ${((1 - inn) * 26).toFixed(1)}px, 0)`;
        outroRef.current.style.visibility = inn < 0.004 ? "hidden" : "visible";
        outroRef.current.style.pointerEvents = inn > 0.6 ? "auto" : "none";
      }

      // Umgebung: langsamer Parallax; im Finale wird der echte Raum klar
      // (Überblendung zweier Ebenen statt Filterwechsel – compositor-only).
      if (envRef.current) {
        envRef.current.style.transform = `translate3d(0, ${(-p * 44).toFixed(1)}px, 0)`;
      }
      if (envSharpRef.current) {
        // Der reale Raum wird im Finale erkennbar, bleibt aber Hintergrund –
        // die Porträts dürfen nicht mit dem Gruppenfoto konkurrieren.
        envSharpRef.current.style.opacity = (groupBlend * 0.5).toFixed(3);
      }

      // Kapitelwechsel -> React (Fortschrittsanzeige)
      const next = chapterAt(t);
      if (next !== chapterRef.current) {
        chapterRef.current = next;
        setChapter(next);
      }
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  const goToStop = useCallback(
    (stop: number) => {
      const track = trackRef.current;
      if (!track) return;
      const top = track.getBoundingClientRect().top + window.scrollY;
      const range = track.offsetHeight - window.innerHeight;
      scrollTo(top + progressForStop(stop) * range, 0);
    },
    [scrollTo],
  );

  return (
    <div ref={trackRef} className="relative h-[640vh]">
      <div
        ref={stageRef}
        className="on-dark sticky top-0 h-dvh overflow-hidden bg-deep text-cream"
      >
        {/* Ebene 1 – echter Praxisraum, weit hinten, sehr langsamer Parallax */}
        <div ref={envRef} className="team-env absolute inset-0">
          <div className="team-env-blur absolute inset-0" aria-hidden="true" />
          <div
            ref={envSharpRef}
            className="team-env-sharp absolute inset-0 opacity-0"
            aria-hidden="true"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(23,37,27,0.52)_0%,rgba(23,37,27,0.78)_62%,rgba(23,37,27,0.9)_100%)]"
          />
        </div>

        {/* Ebene 2 – die Szene: Kamera-Raum mit den sechs Porträt-Ebenen */}
        <div
          className="team-scene absolute inset-0"
          style={{ perspective: "var(--stage-perspective, 1400px)" }}
        >
          {/* Verbindungsbahn: eine Linie, ein Attribut pro Frame */}
          <svg
            ref={svgRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="-720 -450 1440 900"
            preserveAspectRatio="none"
          >
            <path
              ref={pathRef}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.22"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/*
            * Die Ebenen sind SELBST die Listenpunkte: ein zusätzlicher
            * Wrapper mit preserve-3d würde zum Containing Block und die
            * Zentrierung (top-1/2) ins Leere laufen lassen.
            */}
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

        {/* Ebene 3 – Intro: bleibt im DOM, weicht beim Scrollen zurück */}
        <div
          ref={introRef}
          className="pointer-events-none absolute inset-0 flex items-center"
        >
          <div className="mx-auto w-full max-w-7xl px-5 md:px-10">
            <p className="text-xs font-semibold tracking-[0.22em] text-accent uppercase">
              {teamIntro.kicker}
            </p>
            <h2 className="font-display mt-4 max-w-2xl text-4xl leading-[1.08] font-medium text-cream md:text-6xl">
              {teamIntro.title}
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-cream/70 md:text-base">
              {teamIntro.text}
            </p>
          </div>
        </div>

        {/* Ebene 4 – Finale: Schlusszeile und Weg zum Termin */}
        <div
          ref={outroRef}
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 px-5 pb-24 opacity-0 md:pb-28"
        >
          <p className="font-display text-center text-2xl font-medium text-cream md:text-3xl">
            {teamOutro.line}
          </p>
          <Button href={teamOutro.cta.href} withArrow>
            {teamOutro.cta.label}
          </Button>
        </div>

        <TeamProgress chapter={chapter} onSelect={goToStop} />
      </div>
    </div>
  );
}
