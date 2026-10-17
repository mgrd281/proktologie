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
import { EarliestFree } from "@/components/booking/EarliestFree";
import {
  SymptomeLayer,
  type SymptomeLayerHandle,
} from "@/components/cinema/layers/SymptomeLayer";
import { TeamStage, type TeamStageHandle } from "@/components/cinema/layers/TeamStage";
import { TerminLayer } from "@/components/cinema/layers/TerminLayer";
import { HeroBackground } from "@/components/hero/HeroBackground";
import { DoctorPortrait } from "@/components/ui/DoctorPortrait";
import { Icon } from "@/components/ui/Icon";
import { arzt } from "@/content/arzt";
import { CINEMA_TEXTS, cinemaSkip } from "@/content/cinema";
import { ctaHref } from "@/content/navigation";
import { filmFrameUrl } from "@/lib/cinema/sources";
import {
  ANCHOR_FRAMES,
  FRAME_LAYERS,
  LEISTUNGEN_SCENE,
  LERP,
  RAIL_SCENES,
  ROOM_BRIGHT,
  SCENES,
  SCENE_COUNT,
  STILL_QUERY,
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
import { clamp, smoothstep } from "@/lib/cinema/timeline";
import { useScrollProgress } from "@/lib/hooks/useScrollProgress";
import { useLenis } from "@/providers/LenisProvider";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

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

/**
 * Ab diesem Abstand zum Ziel springt der Film, statt nachzulaufen: Ein
 * Sprung über die ganze Fahrt (Anker, Überspringen, Pos1/Ende) spulte
 * sonst Hunderte Filmbilder durch – sichtbar nur als Flackern, und jedes
 * davon wurde geladen. Normales Scrollen bewegt das Ziel pro Bild nur um
 * Bruchteile davon und gleitet weiter.
 */
const SNAP_FRAMES = 150;

/** Sichtbarkeit und Lage eines Szenentexts – rAF-Loop und Startbild teilen die Formel. */
function textAt(f: number, i: number, release: number) {
  const alpha = sceneAlpha(f, i);
  /*
   * Gamma drückt die Geisterphase weg (große Serifentypo liest sich
   * schon bei 4 %); unter 12 % wird abgeschaltet. Alle Texte gehen
   * mit dem Release.
   */
  const shown = (alpha < 0.12 ? 0 : Math.pow(alpha, 1.6)) * (1 - release);
  // Eintritt von unten, Austritt nach oben – die Szenen ziehen durch
  const y = (0.5 - sceneLocal(f, i)) * 54;
  return { alpha, shown, y };
}

/** Lesbarkeitsschleier links – in Szene 01 etwas zurückgenommen (s. Loop). */
function scrimAt(f: number, maxAlpha: number, release: number) {
  const scrimEase = 1 - 0.22 * (1 - smoothstep(46, 76, f));
  return (0.35 + maxAlpha * 0.65) * scrimEase * (1 - release);
}

/** Lage des Arzt-Freistellers (Drift über 01–02, dezente Zeiger-Parallaxe). */
function doctorTransform(f: number, pointerX: number) {
  const drift = clamp((f - DOCTOR_SPAN[0]) / (DOCTOR_SPAN[1] - DOCTOR_SPAN[0]));
  const scale = 1.06 - drift * 0.14;
  return (
    `translate3d(${(drift * 8 + pointerX * 0.6).toFixed(2)}%, ${(drift * 4).toFixed(2)}%, 0) ` +
    `scale(${scale.toFixed(3)})`
  );
}

/**
 * Startbild (Frame 1) schon im ausgelieferten HTML – berechnet mit
 * denselben Formeln wie der Loop, damit beim Übernehmen nichts springt.
 * Vorher standen Überschrift, Text und Arzt unsichtbar da, bis das Skript
 * lief (auf langsamem 4G mehrere Sekunden lang nur das Bild).
 */
const START_FRAME = 1;
const START_RELEASE = FRAME_LAYERS.release(START_FRAME);
const HIDDEN: CSSProperties = { opacity: 0, visibility: "hidden" };
const START_TEXT: CSSProperties[] = SCENES.map((_, i) => {
  const t = textAt(START_FRAME, i, START_RELEASE);
  return t.shown <= 0.004
    ? HIDDEN
    : { opacity: Number(t.shown.toFixed(3)), transform: `translate3d(0, ${t.y.toFixed(1)}px, 0)` };
});
const START_MAX_ALPHA = Math.max(...SCENES.map((_, i) => sceneAlpha(START_FRAME, i)));
const START_SCRIM: CSSProperties = {
  opacity: Number(scrimAt(START_FRAME, START_MAX_ALPHA, START_RELEASE).toFixed(3)),
};
const START_DOCTOR: CSSProperties =
  FRAME_LAYERS.doctor(START_FRAME) <= 0.004
    ? HIDDEN
    : {
        opacity: Number(FRAME_LAYERS.doctor(START_FRAME).toFixed(3)),
        transform: doctorTransform(START_FRAME, 0),
      };
const START_GLOW: CSSProperties = {
  opacity: Number((FRAME_LAYERS.glow(START_FRAME) * 0.9).toFixed(3)),
  transform: "translate3d(-8.0%, 6.0%, 0)",
};

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
  const releaseRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLAnchorElement>(null);
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

  /** Darf das Canvas laden und zeichnen? Nur im Bild und nicht unter dem Release. */
  const canvasVisible = useRef({ inView: true, covered: false });
  const syncCanvas = useCallback(() => {
    const v = canvasVisible.current;
    canvasRef.current?.setActive(v.inView && !v.covered && !document.hidden);
  }, []);

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
      canvasVisible.current.inView = entry.isIntersecting;
      syncCanvas();
      if (entry.isIntersecting) dirty.current = true;
    });
    observer.observe(track);
    const onVisibility = () => {
      syncCanvas();
      if (!document.hidden) dirty.current = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncCanvas]);

  const onTeamChapter = useCallback((chapter: number) => {
    const shown = Math.min(6, Math.max(1, chapter));
    if (shown !== teamChapterRef.current) {
      teamChapterRef.current = shown;
      setTeamChapter(shown);
    }
  }, []);

  useEffect(() => {
    // Ruhige Fassung statt Fahrt: reduzierte Bewegung oder zu niedriges Fenster
    const still = window.matchMedia(STILL_QUERY);

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

      current.current = Math.abs(delta) > SNAP_FRAMES ? targetF : current.current + delta * LERP;
      pointer.current.sx += pdx * LERP;
      pointer.current.sy += pdy * LERP;

      const f = current.current;
      const p = progressForFrame(f);

      probe.f = f;
      probe.p = p;

      // Ganz unter dem Release (am Ende der Fahrt) ist vom Film nichts zu
      // sehen – dann lädt und zeichnet das Canvas auch nichts.
      const release = FRAME_LAYERS.release(f);
      probe.release = release;
      const covered = release >= 0.999;
      if (covered !== canvasVisible.current.covered) {
        canvasVisible.current.covered = covered;
        syncCanvas();
      }

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

      // ---- Szenentexte: überlappende Blenden statt Austausch ----
      let maxAlpha = 0;
      for (let i = 0; i < SCENE_COUNT; i++) {
        const el = textRefs.current[i];
        const { alpha, shown, y } = textAt(f, i, release);
        if (alpha > maxAlpha) maxAlpha = alpha;
        if (!el) continue;
        // War null und bleibt null → nichts schreiben
        if (alpha <= 0.004 && textShown.current[i] === 0) continue;
        textShown.current[i] = alpha <= 0.004 ? 0 : 1;
        // Am Ende visibility:hidden, damit keine unsichtbaren Links unter
        // der Cream-Fläche fokussierbar bleiben.
        el.style.opacity = shown.toFixed(3);
        el.style.visibility = shown <= 0.004 ? "hidden" : "visible";
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }

      /*
       * Lesbarkeitsschleier links: bleibt, solange links Text steht.
       * In Szene 01 etwas zurückgenommen – dort trägt die helle Rezeption
       * das Bild, und der volle Schleier würde die Tresenkurve schlucken.
       * Der Nachlass läuft bis Frame 76 auf null aus, alle späteren Szenen
       * behalten exakt ihren bisherigen Wert.
       */
      if (scrimRef.current) {
        scrimRef.current.style.opacity = scrimAt(f, maxAlpha, release).toFixed(3);
      }

      // ---- Arzt-Freisteller: trägt 01–02, weicht den Tafeln ----
      const doctor = FRAME_LAYERS.doctor(f);
      if (doctorRef.current) {
        doctorRef.current.style.opacity = doctor.toFixed(3);
        doctorRef.current.style.visibility = doctor <= 0.004 ? "hidden" : "visible";
        if (doctor > 0.004) {
          doctorRef.current.style.transform = doctorTransform(f, pointer.current.sx);
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
      // „Einführung überspringen“ gehört zum Anfang: Mit Szene 02 tritt der
      // Knopf zurück – unten links stünde er sonst im Text kleiner Handys.
      // Danach führen Kopf-Knopf und Handy-Leiste genauso direkt zum Termin.
      if (skipRef.current) {
        const skip = 1 - smoothstep(30, 55, f);
        skipRef.current.style.opacity = skip.toFixed(3);
        skipRef.current.style.visibility = skip <= 0.004 ? "hidden" : "visible";
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
    const onChange = () => (still.matches ? stop() : start());
    still.addEventListener("change", onChange);
    onChange();
    return () => {
      still.removeEventListener("change", onChange);
      stop();
    };
  }, [syncCanvas]);

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

      {/* Ohne erlaubte Bewegung (oder in sehr niedrigen Fenstern): ruhige,
          vollständige Fassung ohne Scroll-Kopplung */}
      <div className="cinema-still film:hidden">
        <CinemaStatic />
      </div>

      {/*
        * Spurlänge: auf dem Handy 500vh statt 1000vh – dieselbe Fahrt,
        * doppelt so schnell. Zehn Bildschirmhöhen Film vor dem ersten
        * Inhalt waren auf dem Telefon zu viel. Alles rechnet mit dem
        * relativen Fortschritt (useScrollProgress), nichts mit Pixeln.
        */}
      <div
        ref={trackRef}
        data-header-solid={headerSolidProgress()}
        data-total-frames={TOTAL_FRAMES}
        className="cinema-track relative hidden h-[500vh] film:block md:h-[1000vh]"
      >
        <div
          ref={stageRef}
          className="cinema-stage on-dark sticky top-0 origin-top overflow-hidden bg-deep text-cream"
        >
          {/* 1 – Verläufe unter der Lichtsequenz (DOM: scharf und billig) */}
          <div ref={ambientRef} className="cinema-ambient absolute inset-0">
            <HeroBackground />
          </div>

          {/*
            * 1b – Der erste Filmframe als echtes Bild. Das Canvas kann erst
            * zeichnen, wenn React hydriert ist und der FrameStore läuft –
            * auf 4G gemessene ~6 s, in denen die Bühne sonst nur den
            * Verlauf zeigte. Dieses Bild steht im ausgelieferten HTML und
            * braucht kein JavaScript; sobald das Canvas malt, deckt es das
            * Bild vollständig ab.
            */}
          <picture>
            {/*
              * Bei reduzierter Bewegung wird KEIN Filmmaterial geladen –
              * ein 1×1-Pixel gewinnt die Quellenwahl, bevor der Browser
              * etwas herunterlädt. Die ruhige Fassung trägt dort ohnehin
              * eigene Bilder.
              */}
            <source
              media="(prefers-reduced-motion: reduce), (max-height: 449px)"
              srcSet="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            />
            {/* Dieselbe Adresse wie im FrameStore (mit Filmversion) – so holt
                der Store das erste Bild aus dem Browser-Speicher statt erneut */}
            <source media="(max-width: 767px)" srcSet={filmFrameUrl("mobile", 1)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={filmFrameUrl("desktop", 1)}
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>

          {/* 2 – DER Compositor: Lichtsequenz + echter Untersuchungsraum */}
          <SceneCanvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            onContentReady={() => {
              dirty.current = true;
            }}
          />

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
            style={START_GLOW}
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
            style={START_DOCTOR}
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

          {/*
            * 9 – Szenentexte und ihr Lesbarkeitsschleier (die Konstante links).
            * Auf dem Handy steht der Text über die volle Breite – der Schleier
            * läuft dort nicht ins Durchsichtige aus, sonst stünde die rechte
            * Texthälfte in den hellen Untersuchungsraum-Frames ungeschützt.
            */}
          <div
            ref={scrimRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-deep via-deep/85 to-transparent max-md:bg-[linear-gradient(to_right,rgba(23,37,27,0.9),rgba(23,37,27,0.62))] md:w-[66%] lg:w-[56%]"
            style={START_SCRIM}
          />

          {/*
            * 10 – Praxis-Karte (Szene 08): ÜBER dem Text-Schleier – unter
            * lg trägt sie die Szene allein über der vollen Breite und darf
            * nicht von ihm abgedunkelt werden.
            */}
          <PraxisLayer ref={praxisRef} />
          {CINEMA_TEXTS.map((content, index) => (
            <StateText
              key={SCENES[index].id}
              ref={(el) => {
                if (el) textRefs.current[index] = el;
              }}
              content={content}
              isFirst={index === 0}
              initialStyle={START_TEXT[index]}
              ctaNote={index === 0 ? <EarliestFree /> : undefined}
              className={
                /*
                 * Unter lg liegt die Praxis-Karte mittig über der vollen
                 * Breite – dort trägt SIE die Szene (Adresse, Zeiten,
                 * CTAs); der Intro-Text würde mit ihr kollidieren. Ebenso
                 * trägt auf dem Handy die Termin-Vorschau ihre Szene allein.
                 */
                SCENES[index].id === "praxis"
                  ? "w-full max-lg:hidden md:w-[62%] lg:w-[52%]"
                  : SCENES[index].id === "termin"
                    ? "w-full max-md:hidden md:w-[62%] lg:w-[52%]"
                    : "w-full md:w-[62%] lg:w-[52%]"
              }
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

            {/* Ab md links neben dem Chat-Knopf (unten rechts), nicht darunter */}
            <p
              aria-hidden={active !== TEAM_SCENE}
              className="cinema-counter pointer-events-none absolute right-5 bottom-24 font-display text-sm text-cream/70 tabular-nums transition-opacity duration-500 md:right-28 md:bottom-10"
              style={{ opacity: active === TEAM_SCENE ? 1 : 0 }}
            >
              {memberLabel(teamChapter)}
            </p>

            {/*
              * Überspringen: Wer die Fahrt kennt oder es eilig hat, landet
              * sofort bei der Terminbuchung (Sprung ohne Durchspulen, Fokus
              * auf der Buchung – siehe LenisProvider). Ein ruhiger Knopf mit
              * eigener Fläche, damit er über hellen wie dunklen Bildern lesbar
              * bleibt. Sichtbar in der Eröffnung (s. Loop).
              * Auf dem Handy klein und ohne Schrift (Doppelpfeil, Name nur für
              * Screenreader), rechts: Links unten lag er auf manchen iPhones
              * über der Zeile „Freie Termine ab …“. Unter 360 px Breite reicht
              * auch rechts der Platz nicht – dort fehlt er; „Termin vereinbaren“
              * führt zum selben Ziel.
              */}
            <a
              ref={skipRef}
              href={ctaHref}
              className="pointer-events-auto absolute bottom-24 inline-flex min-h-11 items-center gap-2 rounded-full border border-cream/25 bg-deep/70 text-xs font-medium tracking-wide text-cream transition-colors duration-200 hover:border-accent hover:text-accent max-md:right-5 max-md:size-11 max-md:justify-center md:bottom-9 md:left-10 md:px-4 [@media(max-width:359px)]:hidden"
            >
              <span className="max-md:sr-only">{cinemaSkip}</span>
              <Icon name="arrow-down" size={14} className="max-md:hidden" />
              <Icon name="chevrons-down" size={18} className="md:hidden" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
