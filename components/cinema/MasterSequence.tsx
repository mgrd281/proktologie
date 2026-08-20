"use client";

import { CinemaStatic } from "@/components/cinema/CinemaStatic";
import { FrameCounter, type FrameCounterHandle } from "@/components/cinema/FrameCounter";
import { MasterRail } from "@/components/cinema/MasterRail";
import { SceneCanvas, type SceneCanvasHandle } from "@/components/cinema/SceneCanvas";
import {
  LeistungenLayer,
  type LeistungenLayerHandle,
} from "@/components/cinema/layers/LeistungenLayer";
import { PraxisLayer } from "@/components/cinema/layers/PraxisLayer";
import { StateText } from "@/components/cinema/layers/StateText";
import {
  SymptomeLayer,
  type SymptomeLayerHandle,
} from "@/components/cinema/layers/SymptomeLayer";
import { TeamStage, type TeamStageHandle } from "@/components/cinema/layers/TeamStage";
import { TerminLayer } from "@/components/cinema/layers/TerminLayer";
import { HeroBackground } from "@/components/hero/HeroBackground";
import { DoctorPortrait } from "@/components/ui/DoctorPortrait";
import { arzt } from "@/content/arzt";
import { CINEMA_TEXTS } from "@/content/cinema";
import { teamIntro } from "@/content/team";
import {
  ANCHOR_FRAMES,
  FRAME_LAYERS,
  LEISTUNGEN_SCENE,
  LERP,
  RAIL_SCENES,
  ROOM_BRIGHT,
  SCENES,
  SCENE_COUNT,
  SYMPTOME_SCENE,
  TEAM_SCENE,
  TOTAL_FRAMES,
  activeScene,
  brightnessF,
  frameForProgress,
  headerSolidProgress,
  progressForFrame,
  sceneAlpha,
  sceneLocal,
} from "@/lib/cinema/frames";
import { clamp } from "@/lib/cinema/timeline";
import { useScrollProgress } from "@/lib/hooks/useScrollProgress";
import { useLenis } from "@/providers/LenisProvider";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DAS Filmwerk der Startseite – eine scrubbares 500-Frame-Master-Timeline.
 *
 * 01 Willkommen · 02 Dr. Kunstreich · 03 Leistungen · 04 Beschwerden
 * (+ Symptome) · 05 Diagnostik · 06 Behandlung · 07 Warum diese Praxis /
 * Team · 08 Praxis & Standort · FINAL Termin → Release in die Buchung.
 *
 * Master-Fortschritt (Spezifikation):
 *
 *   progress = clamp((scrollY − trackTop) / (trackHeight − viewport), 0, 1)
 *   targetFrame = 1 + round(progress · 499)
 *   currentFrame += (targetFrame − currentFrame) · 0.12   ← EIN LERP
 *
 * Lenis liefert das weiche Scrollen; der eine rAF-Loop folgt ihm mit
 * gewichteter Verzögerung. Roher scrollY wird NIE direkt auf eine
 * Transformation abgebildet.
 *
 * Alle Ebenen – Canvas-Compositor, Texte, Team, Korridor, Zyklus, Bahn,
 * Zähler – sind zustandslose Funktionen von currentFrame
 * (lib/cinema/frames.ts). Rückwärts-Scrollen kehrt deshalb Kamera,
 * Blenden, Team-Fahrt, Bahn und Typografie exakt um.
 */

/** Anzeige des Team-Unterfortschritts (01/06 … 06/06). */
const memberLabel = (n: number) => `${String(n).padStart(2, "0")} / 06`;

/** Unterhalb dieser Frame-Differenz ruht die Szene – keine Schreibvorgänge. */
const EPSILON_F = 0.02;

/** Drift des Arzt-Freistellers über die Szenen 01–02. */
const DOCTOR_SPAN: [number, number] = [SCENES[0].first, SCENES[1].last];

export function MasterSequence() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const doctorRef = useRef<HTMLDivElement>(null);
  const praxisRef = useRef<HTMLDivElement>(null);
  const terminRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const releaseRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const trailGlowRef = useRef<SVGPathElement>(null);
  const textRefs = useRef<HTMLDivElement[]>([]);
  const textShown = useRef<number[]>(new Array(SCENE_COUNT).fill(-1));
  const canvasRef = useRef<SceneCanvasHandle>(null);
  const counterRef = useRef<FrameCounterHandle>(null);
  const teamRef = useRef<TeamStageHandle>(null);
  const leistungenRef = useRef<LeistungenLayerHandle>(null);
  const symptomeRef = useRef<SymptomeLayerHandle>(null);

  const target = useRef(0);
  const current = useRef(1);
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const sizeRef = useRef({ w: 1440, h: 900 });
  const dirty = useRef(true);
  const activeRef = useRef(0);
  const teamChapterRef = useRef(1);
  const lastTrailQ = useRef(-1);

  const [active, setActive] = useState(0);
  const [teamChapter, setTeamChapter] = useState(1);
  const { scrollTo } = useLenis();

  useScrollProgress(trackRef, (p) => {
    target.current = p;
  });

  useEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };
      lastTrailQ.current = -1;
      dirty.current = true;
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Zeiger-Parallaxe nur auf großen Zeigern – dezent und geglättet.
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

  // Fahrt außer Sicht → Compositor pausieren (Preload/Decode ruhen)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(([entry]) => {
      canvasRef.current?.setActive(entry.isIntersecting);
      if (entry.isIntersecting) dirty.current = true;
    });
    observer.observe(track);
    const onVisibility = () => {
      canvasRef.current?.setActive(!document.hidden);
      if (!document.hidden) dirty.current = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const onTeamChapter = useCallback((chapter: number) => {
    const shown = Math.min(6, Math.max(1, chapter));
    if (shown !== teamChapterRef.current) {
      teamChapterRef.current = shown;
      setTeamChapter(shown);
    }
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Probe-Fläche der Browser-Tests – ein Objekt, nur mutiert
    const probe = { f: 1, p: 0, scene: 0, release: 0 };
    (window as unknown as { __cinema?: typeof probe }).__cinema = probe;

    let raf = 0;
    let running = false;
    const render = () => {
      if (!running) return;
      raf = requestAnimationFrame(render);

      const targetF = frameForProgress(target.current);
      const delta = targetF - current.current;
      const pdx = pointer.current.x - pointer.current.sx;
      const pdy = pointer.current.y - pointer.current.sy;
      const settled =
        Math.abs(delta) < EPSILON_F &&
        Math.abs(pdx) < 0.001 &&
        Math.abs(pdy) < 0.001;
      if (settled && !dirty.current) return;
      dirty.current = false;

      current.current += delta * LERP;
      pointer.current.sx += pdx * LERP;
      pointer.current.sy += pdy * LERP;

      const f = current.current;
      const p = progressForFrame(f);

      probe.f = f;
      probe.p = p;

      // ---- Compositor: Lichtsequenz + echter Untersuchungsraum ----
      canvasRef.current?.render(f, { x: pointer.current.sx, y: pointer.current.sy });

      // ---- DOM-Umgebung 1: Verläufe unter der Lichtsequenz ----
      const ambient = FRAME_LAYERS.ambient(f);
      if (ambientRef.current) {
        ambientRef.current.style.opacity = ambient.toFixed(3);
        ambientRef.current.style.visibility = ambient <= 0.004 ? "hidden" : "visible";
      }

      // ---- DOM-Umgebung 2: Empfangs-Ambiente (07 – Finale) ----
      const room = FRAME_LAYERS.room(f);
      if (roomRef.current) {
        roomRef.current.style.opacity = room.toFixed(3);
        roomRef.current.style.visibility = room <= 0.004 ? "hidden" : "visible";
        roomRef.current.style.transform = `translate3d(0, ${(-p * 40).toFixed(2)}px, 0)`;
      }

      // ---- Durchgehende Motive: Glow und grüne Bahn ----
      const glow = FRAME_LAYERS.glow(f);
      if (glowRef.current) {
        glowRef.current.style.opacity = (glow * 0.9).toFixed(3);
        glowRef.current.style.transform =
          `translate3d(${(-8 + p * 26).toFixed(1)}%, ${(6 - p * 14).toFixed(1)}%, 0)`;
      }

      const trail = FRAME_LAYERS.trajectory(f);
      const { w, h } = sizeRef.current;
      /*
       * Die Bahn ist EIN durchgehender Pfad durch die ganze Praxis –
       * Position = Funktion des Master-Frames. Das `d`-Attribut ist der
       * einzige Schreibvorgang außerhalb von transform/opacity, deshalb
       * quantisiert (0.5 Frames ≈ 0.9 vh): Während des Ausklangs teilen
       * sich viele Ticks denselben Wert.
       */
      const trailQ = Math.round(f * 2) / 2;
      if (trailQ !== lastTrailQ.current) {
        lastTrailQ.current = trailQ;
        const tp = progressForFrame(trailQ);
        const y0 = h * (0.82 - tp * 0.1);
        const y1 = h * (0.6 - tp * 0.06);
        const y2 = h * (0.74 - tp * 0.2);
        const d =
          `M${(-w * 0.05).toFixed(0)} ${y0.toFixed(0)} ` +
          `C${(w * 0.28).toFixed(0)} ${(y0 - h * 0.12).toFixed(0)}, ` +
          `${(w * 0.52).toFixed(0)} ${y1.toFixed(0)}, ` +
          `${(w * 1.05).toFixed(0)} ${y2.toFixed(0)}`;
        trailRef.current?.setAttribute("d", d);
        trailGlowRef.current?.setAttribute("d", d);
      }
      if (trailRef.current) trailRef.current.style.opacity = trail.toFixed(3);
      if (trailGlowRef.current) trailGlowRef.current.style.opacity = (trail * 0.5).toFixed(3);

      const release = FRAME_LAYERS.release(f);
      probe.release = release;

      // ---- Szenentexte: überlappende Blenden statt Austausch ----
      let maxAlpha = 0;
      for (let i = 0; i < SCENE_COUNT; i++) {
        const el = textRefs.current[i];
        const alpha = sceneAlpha(f, i);
        if (alpha > maxAlpha) maxAlpha = alpha;
        if (!el) continue;
        // War null und bleibt null → nichts schreiben
        if (alpha <= 0.004 && textShown.current[i] === 0) continue;
        textShown.current[i] = alpha <= 0.004 ? 0 : 1;
        /*
         * Gamma drückt die Geisterphase weg (große Serifentypo liest sich
         * schon bei 4 %); unter 12 % wird abgeschaltet. Alle Texte gehen
         * mit dem Release – am Ende visibility:hidden, damit keine
         * unsichtbaren Links unter der Cream-Fläche fokussierbar bleiben.
         */
        const shown = (alpha < 0.12 ? 0 : Math.pow(alpha, 1.6)) * (1 - release);
        el.style.opacity = shown.toFixed(3);
        el.style.visibility = shown <= 0.004 ? "hidden" : "visible";
        // Eintritt von unten, Austritt nach oben – die Szenen ziehen durch
        const local = sceneLocal(f, i);
        el.style.transform = `translate3d(0, ${((0.5 - local) * 54).toFixed(1)}px, 0)`;
      }

      // Lesbarkeitsschleier links: bleibt, solange links Text steht
      if (scrimRef.current) {
        scrimRef.current.style.opacity = ((0.35 + maxAlpha * 0.65) * (1 - release)).toFixed(3);
      }

      // ---- Arzt-Freisteller: trägt 01–02, weicht den Tafeln ----
      const doctor = FRAME_LAYERS.doctor(f);
      if (doctorRef.current) {
        doctorRef.current.style.opacity = doctor.toFixed(3);
        doctorRef.current.style.visibility = doctor <= 0.004 ? "hidden" : "visible";
        if (doctor > 0.004) {
          const drift = clamp(
            (f - DOCTOR_SPAN[0]) / (DOCTOR_SPAN[1] - DOCTOR_SPAN[0]),
          );
          const scale = 1.06 - drift * 0.14;
          doctorRef.current.style.transform =
            `translate3d(${(drift * 8 + pointer.current.sx * 0.6).toFixed(2)}%, ${(drift * 4).toFixed(2)}%, 0) ` +
            `scale(${scale.toFixed(3)})`;
        }
      }

      // ---- Leistungs-Korridor (Szene 03 – bleibt im Film) ----
      const leistungen = FRAME_LAYERS.leistungen(f);
      leistungenRef.current?.render(sceneLocal(f, LEISTUNGEN_SCENE), leistungen, {
        x: pointer.current.sx,
        y: pointer.current.sy,
      });

      // ---- Symptom-Zyklus (innere Tiefe der Szene 04) ----
      symptomeRef.current?.render(sceneLocal(f, SYMPTOME_SCENE), FRAME_LAYERS.symptome(f));

      // ---- Team-Untersequenz (Szene 07) ----
      const teamWeight = FRAME_LAYERS.team(f);
      teamRef.current?.render(sceneLocal(f, TEAM_SCENE), teamWeight, {
        x: pointer.current.sx,
        y: pointer.current.sy,
      });
      /*
       * Auf schmalen Schirmen liegt der Text zwangsläufig über den hellen
       * Ebenen (Porträts, Tafeln). Dieser Schleier kommt und geht mit
       * ihnen – er liegt im DOM bewusst VOR der Praxis-Karte.
       */
      if (veilRef.current) {
        const veil = Math.max(teamWeight, leistungen);
        veilRef.current.style.opacity = veil.toFixed(3);
        veilRef.current.style.visibility = veil <= 0.004 ? "hidden" : "visible";
      }

      // ---- Praxis-Karte (Szene 08) ----
      const praxis = FRAME_LAYERS.praxisCard(f);
      if (praxisRef.current) {
        praxisRef.current.style.opacity = praxis.toFixed(3);
        praxisRef.current.style.visibility = praxis <= 0.004 ? "hidden" : "visible";
        praxisRef.current.style.transform = `translate3d(0, ${((1 - praxis) * 30).toFixed(1)}px, 0)`;
      }

      // ---- Termin-Vorschau: reitet auf dem Release, verblasst nie ----
      const termin = FRAME_LAYERS.terminCard(f);
      if (terminRef.current) {
        terminRef.current.style.opacity = termin.toFixed(3);
        terminRef.current.style.visibility = termin <= 0.004 ? "hidden" : "visible";
        terminRef.current.style.transform = `translate3d(0, ${((1 - termin) * 36).toFixed(1)}px, 0)`;
      }

      // ---- Scroll-Hinweis nur ganz am Anfang ----
      if (cueRef.current) {
        cueRef.current.style.opacity = Math.max(0, 1 - (f - 1) / 25).toFixed(3);
      }

      /*
       * Release: Die Bühne wird NICHT skaliert (das legte die Seitenkanten
       * frei), sondern löst sich in genau den Farbton auf, mit dem die
       * Kontakt-Sektion beginnt. Die Termin-Vorschau liegt im DOM über
       * diesem Schleier und bleibt deshalb stehen.
       */
      if (releaseRef.current) {
        releaseRef.current.style.opacity = release.toFixed(3);
        releaseRef.current.style.visibility = release <= 0.004 ? "hidden" : "visible";
      }
      // Leiste, Zähler und Hinweis gehören zum Film – sie gehen mit.
      if (chromeRef.current) {
        const chrome = 1 - release;
        chromeRef.current.style.opacity = chrome.toFixed(3);
        chromeRef.current.style.visibility = chrome <= 0.004 ? "hidden" : "visible";
      }

      // Ab dem Untersuchungsraum ist die Bühne hell – Leiste, Zähler und
      // Bahn brauchen dann dunkle Farben. Nur bei Wechsel schreiben.
      const phase = brightnessF(f) > ROOM_BRIGHT ? "bright" : "dark";
      if (stageRef.current && stageRef.current.dataset.phase !== phase) {
        stageRef.current.dataset.phase = phase;
      }

      // ---- Zähler + Leiste (React-State nur beim Szenenwechsel) ----
      const scene = activeScene(f);
      probe.scene = scene;
      counterRef.current?.set(f, scene);
      const railActive = Math.min(scene, RAIL_SCENES.length - 1);
      if (railActive !== activeRef.current) {
        activeRef.current = railActive;
        setActive(railActive);
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      dirty.current = true;
      raf = requestAnimationFrame(render);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    /*
     * Die Umschaltung Track/ruhige Fassung ist reines CSS und reagiert
     * SOFORT auf die Systemeinstellung – der Loop zieht hier mit, statt
     * die Präferenz nur einmal beim Mount zu lesen.
     */
    const onChange = () => (reduced.matches ? stop() : start());
    reduced.addEventListener("change", onChange);
    onChange();
    return () => {
      reduced.removeEventListener("change", onChange);
      stop();
    };
  }, []);

  const goToScene = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const top = track.getBoundingClientRect().top + window.scrollY;
      const range = track.offsetHeight - window.innerHeight;
      scrollTo(top + progressForFrame(ANCHOR_FRAMES[index]) * range, 0);
    },
    [scrollTo],
  );

  return (
    <section id="hero" aria-label="Einführung" className="relative">
      {/*
        * Ankermarke für /#team. Sie hängt an der SECTION, nicht am Track:
        * Bei reduzierter Bewegung (und ohne JavaScript) ist der Track
        * display:none – ein Anker darin hätte keine Box. An der Section
        * trifft sie in beiden Fassungen den Team-Teil. Bewusst nicht
        * aria-hidden: Die Anker-Navigation setzt den Fokus hierher.
        */}
      <span id="team" className="absolute top-[64%] left-0 block h-px w-px" />
      <noscript>
        <style>{`.cinema-track{display:none !important}.cinema-still{display:block !important}`}</style>
      </noscript>

      {/* Ohne erlaubte Bewegung: ruhige, vollständige Fassung ohne Scroll-Kopplung */}
      <div className="cinema-still motion-safe:hidden">
        <CinemaStatic />
      </div>

      <div
        ref={trackRef}
        data-header-solid={headerSolidProgress()}
        data-total-frames={TOTAL_FRAMES}
        className="cinema-track relative hidden h-[1000vh] motion-safe:block"
      >
        <div
          ref={stageRef}
          className="on-dark sticky top-0 h-dvh origin-top overflow-hidden bg-deep text-cream"
        >
          {/* 1 – Verläufe unter der Lichtsequenz (DOM: scharf und billig) */}
          <div ref={ambientRef} className="cinema-ambient absolute inset-0">
            <HeroBackground />
          </div>

          {/* 2 – DER Compositor: Lichtsequenz + echter Untersuchungsraum */}
          <SceneCanvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* 3 – Empfangs-Ambiente: trägt 07 bis zum Release */}
          <div
            ref={roomRef}
            className="cinema-room team-env absolute inset-0"
            style={{ opacity: 0 }}
          >
            <div className="team-env-blur absolute inset-0" aria-hidden="true" />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(to_top,rgba(23,37,27,0.22)_0%,rgba(23,37,27,0.07)_45%,transparent_100%)]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_60%_100%_at_58%_120%,rgba(134,188,35,0.22)_0%,transparent_70%)]"
            />
          </div>

          {/* 4 – durchgehender Glow */}
          <div
            ref={glowRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_40%_at_62%_38%,rgba(134,188,35,0.16)_0%,transparent_70%)]"
          />

          {/* 5 – Team-Ebenen (erscheinen vor ihrer Szene, weichen danach zurück) */}
          <TeamStage ref={teamRef} onChapter={onTeamChapter} />

          {/* 6 – die grüne Bahn: EIN Pfad durch die ganze Praxis */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <path
              ref={trailGlowRef}
              className="cinema-trail-glow"
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.22"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              ref={trailRef}
              className="cinema-trail"
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.55"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>

          {/* 7 – Arzt-Freisteller (trägt 01–02) */}
          <div
            ref={doctorRef}
            className="pointer-events-none absolute inset-y-0 right-0 w-[52%] origin-bottom md:w-[44%] xl:right-[4%] xl:w-[38%]"
            style={{ opacity: 0, visibility: "hidden" }}
          >
            <DoctorPortrait
              alt={arzt.portraitAlt}
              priority
              variant="cutout"
              className="h-full w-full pt-20"
            />
          </div>

          {/* 8 – Leistungs-Korridor und Symptom-Zyklus */}
          <LeistungenLayer ref={leistungenRef} />
          <SymptomeLayer ref={symptomeRef} />

          {/*
            * Leseschleier für schmale Schirme: Er dämpft die hellen Ebenen
            * UNTER dem Text (Porträts, Tafeln) – und liegt deshalb bewusst
            * VOR der Praxis-Karte im DOM: Die Karte selbst darf nie unter
            * dem Schleier stehen.
            */}
          <div
            ref={veilRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(23,37,27,0.62)_0%,rgba(23,37,27,0.5)_58%,rgba(23,37,27,0.32)_100%)] md:hidden"
            style={{ opacity: 0, visibility: "hidden" }}
          />

          {/* 9 – Praxis-Karte (Szene 08) */}
          <PraxisLayer ref={praxisRef} />

          {/* 10 – Szenentexte und ihr Lesbarkeitsschleier (die Konstante links) */}
          <div
            ref={scrimRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-deep via-deep/85 to-transparent md:w-[66%] lg:w-[56%]"
          />
          {CINEMA_TEXTS.map((content, index) => (
            <StateText
              key={SCENES[index].id}
              ref={(el) => {
                if (el) textRefs.current[index] = el;
              }}
              content={content}
              isFirst={index === 0}
              className="w-full md:w-[62%] lg:w-[52%]"
            />
          ))}

          {/*
            * Schleier oben: Der Header liegt transparent über der Bühne –
            * ohne diesen Verlauf würde seine helle Schrift verschwinden,
            * sobald der Raum hell wird.
            */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-deep/75 via-deep/35 to-transparent"
          />

          {/* Release: löst die Bühne in den Farbton der Kontakt-Sektion auf */}
          <div
            ref={releaseRef}
            aria-hidden="true"
            className="cinema-release pointer-events-none absolute inset-0 bg-cream"
            style={{ opacity: 0, visibility: "hidden" }}
          />

          {/* 11 – Termin-Vorschau: liegt ÜBER dem Release und reitet auf ihm */}
          <TerminLayer ref={terminRef} />

          {/* 12 – Leiste, FRAME-Zähler, Team-Unterzähler, Scroll-Hinweis:
              eine Gruppe, damit sie gemeinsam mit dem Release verschwinden */}
          <div ref={chromeRef} className="pointer-events-none absolute inset-0">
            <MasterRail active={active} onSelect={goToScene} />

            <FrameCounter ref={counterRef} />

            <p
              aria-hidden={active !== TEAM_SCENE}
              className="cinema-counter pointer-events-none absolute right-5 bottom-8 font-display text-sm text-cream/70 tabular-nums transition-opacity duration-500 md:right-10 md:bottom-10"
              style={{ opacity: active === TEAM_SCENE ? 1 : 0 }}
            >
              {memberLabel(teamChapter)}
            </p>

            <div
              ref={cueRef}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-9 left-5 flex items-center gap-4 md:left-10"
            >
              <span className="flex h-9 w-5.5 shrink-0 items-start justify-center rounded-full border border-cream/30 pt-1.5">
                <span className="animate-scroll-cue block h-1.5 w-1 rounded-full bg-accent" />
              </span>
              <span className="text-[11px] tracking-[0.16em] text-cream/50 uppercase">
                {teamIntro.scrollCue}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
