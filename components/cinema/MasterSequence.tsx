"use client";

import { CinemaStatic } from "@/components/cinema/CinemaStatic";
import { MasterRail } from "@/components/cinema/MasterRail";
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
import {
  CanvasSequence,
  type CanvasSequenceHandle,
} from "@/components/hero/sequence/CanvasSequence";
import { DoctorPortrait } from "@/components/ui/DoctorPortrait";
import { arzt } from "@/content/arzt";
import { CINEMA_TEXTS } from "@/content/cinema";
import { teamIntro } from "@/content/team";
import {
  AMBIENT_FIRST,
  AMBIENT_LAST,
  HEADER_SOLID_AT,
  LAYERS,
  LEISTUNGEN_INDEX,
  ROOM_BRIGHT,
  SYMPTOME_INDEX,
  TEAM_INDEX,
  TEXT_BANDS,
  TEXT_BAND_COUNT,
  activeState,
  brightness,
  clamp,
  localProgress,
  progressForState,
  spanProgress,
  textBandLocal,
  textBandWeight,
} from "@/lib/cinema/timeline";
import { useScrollProgress } from "@/lib/hooks/useScrollProgress";
import { useLenis } from "@/providers/LenisProvider";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DIE Kamerafahrt der Startseite – neun Zustände, eine Bewegung.
 *
 * 01 Willkommen · 02 Beschwerden · 03 Leistungen · 04 Symptome ·
 * 05 Diagnostik · 06 Behandlung · 07 Team · 08 Praxis · 09 Termin –
 * danach übergibt der Auslauf direkt an die Buchung (#kontakt ist die
 * erste Sektion nach der Fahrt).
 *
 * Es gilt weiterhin: EIN Track, EIN Fortschritt, EIN
 * requestAnimationFrame-Loop. Der Scroll liefert nur ein Ziel; der Loop
 * nähert sich ihm mit 0.14 an – zusammen mit Lenis (duration 1.2,
 * exponentieller Ausklang) ergibt das die gewichtete Bewegung, die nach
 * dem Radstopp noch nachläuft. Kein roher scrollY wird je direkt auf eine
 * Transformation abgebildet.
 *
 * Welche Ebene wann sichtbar ist, entscheidet ausschließlich
 * lib/cinema/timeline.ts. Jede Ebene hat dort ein Band, das früher
 * beginnt und später endet als ihr Zustand – die Szenen erben einander:
 * Der Arzt bleibt, während die Praxis-Worte kommen; die Leistungs-Tafeln
 * laufen in die Symptome hinein aus; der ECHTE Untersuchungsraum trägt
 * Diagnostik UND Behandlung; Team steht, bevor Behandlung geht; die
 * Buchungs-Vorschau reitet auf dem Auslauf in die echte Buchung.
 */

/** Anzeige des Team-Unterfortschritts (01/06 … 06/06). */
const memberLabel = (n: number) => `${String(n).padStart(2, "0")} / 06`;

/** Trägheit der Kamera – der zweite, feinere Nachlauf über Lenis. */
const LERP = 0.14;
/** Unterhalb dieser Differenz ruht die Szene – keine Schreibvorgänge. */
const EPSILON = 0.00015;

export function MasterSequence() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const examRef = useRef<HTMLDivElement>(null);
  const examSoftRef = useRef<HTMLDivElement>(null);
  const examSharpRef = useRef<HTMLDivElement>(null);
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
  const textShown = useRef<number[]>(new Array(TEXT_BAND_COUNT).fill(-1));
  const sequenceRef = useRef<CanvasSequenceHandle>(null);
  const teamRef = useRef<TeamStageHandle>(null);
  const leistungenRef = useRef<LeistungenLayerHandle>(null);
  const symptomeRef = useRef<SymptomeLayerHandle>(null);

  const target = useRef(0);
  const current = useRef(0);
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const sizeRef = useRef({ w: 1440, h: 900 });
  const dirty = useRef(true);
  const activeRef = useRef(0);
  const teamChapterRef = useRef(1);
  const lastTrailP = useRef(-1);

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
      lastTrailP.current = -1;
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

  const onTeamChapter = useCallback((chapter: number) => {
    const shown = Math.min(6, Math.max(1, chapter));
    if (shown !== teamChapterRef.current) {
      teamChapterRef.current = shown;
      setTeamChapter(shown);
    }
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let raf = 0;
    let running = false;
    const render = () => {
      if (!running) return;
      raf = requestAnimationFrame(render);

      const delta = target.current - current.current;
      const pdx = pointer.current.x - pointer.current.sx;
      const pdy = pointer.current.y - pointer.current.sy;
      const settled =
        Math.abs(delta) < EPSILON &&
        Math.abs(pdx) < 0.001 &&
        Math.abs(pdy) < 0.001;
      if (settled && !dirty.current) return;
      dirty.current = false;

      current.current += delta * LERP;
      pointer.current.sx += pdx * LERP;
      pointer.current.sy += pdy * LERP;

      const p = current.current;

      // ---- Umgebung 1: Lichtsequenz (trägt 01–05) ----
      const ambient = LAYERS.ambient(p);
      if (ambientRef.current) {
        ambientRef.current.style.opacity = ambient.toFixed(3);
        ambientRef.current.style.visibility = ambient <= 0.004 ? "hidden" : "visible";
      }
      sequenceRef.current?.setProgress(spanProgress(p, AMBIENT_FIRST, AMBIENT_LAST));

      // ---- Umgebung 2: der ECHTE Untersuchungsraum (Diagnostik + Behandlung) ----
      const exam = LAYERS.exam(p);
      if (examRef.current) {
        examRef.current.style.opacity = exam.toFixed(3);
        examRef.current.style.visibility = exam <= 0.004 ? "hidden" : "visible";
        if (exam > 0.004) {
          /*
           * Kamerabewegung im Raum: Die weiche Rückwand wandert mit halbem,
           * die scharfe Ebene mit erhöhtem Faktor – dazu ein langsamer
           * Zoom von 1.06 auf 1.00. Nur transform, nichts anderes.
           */
          const drift = clamp((p - 0.43) / (0.79 - 0.43));
          const scale = (1.06 - drift * 0.06).toFixed(4);
          if (examSoftRef.current) {
            examSoftRef.current.style.transform =
              `translate3d(0, ${(-drift * 18).toFixed(1)}px, 0) scale(${scale})`;
          }
          if (examSharpRef.current) {
            examSharpRef.current.style.transform =
              `translate3d(${(pointer.current.sx * -8).toFixed(1)}px, ${(-drift * 46).toFixed(1)}px, 0) scale(${scale})`;
          }
        }
      }

      // ---- Umgebung 3: Empfangs-Ambiente (Team, Praxis, Termin) ----
      const room = LAYERS.room(p);
      if (roomRef.current) {
        roomRef.current.style.opacity = room.toFixed(3);
        roomRef.current.style.visibility = room <= 0.004 ? "hidden" : "visible";
        roomRef.current.style.transform = `translate3d(0, ${(-p * 40).toFixed(2)}px, 0)`;
      }

      // ---- Durchgehende Motive: Glow und grüne Bahn ----
      const glow = LAYERS.glow(p);
      if (glowRef.current) {
        glowRef.current.style.opacity = (glow * 0.9).toFixed(3);
        glowRef.current.style.transform =
          `translate3d(${(-8 + p * 26).toFixed(1)}%, ${(6 - p * 14).toFixed(1)}%, 0)`;
      }

      const trail = LAYERS.trajectory(p);
      const { w, h } = sizeRef.current;
      /*
       * Die Bahn wandert mit der Fahrt von links unten nach rechts oben und
       * legt sich im Team-Zustand flach auf den Boden – ein Faden, der nie
       * reißt. Das `d`-Attribut ist der einzige Schreibvorgang außerhalb
       * von transform/opacity – deshalb quantisiert (Schritt 0.0025 ≈ 3vh):
       * Während des Ausklangs teilen sich viele Frames denselben Wert, und
       * die SVG-Ebene wird nicht pro Frame neu gezeichnet.
       */
      const trailP = Math.round(p * 400) / 400;
      if (trailP !== lastTrailP.current) {
        lastTrailP.current = trailP;
        const y0 = h * (0.82 - trailP * 0.1);
        const y1 = h * (0.6 - trailP * 0.06);
        const y2 = h * (0.74 - trailP * 0.2);
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

      const release = LAYERS.release(p);

      // ---- Textbänder: überlappende Blenden statt Austausch ----
      let maxWeight = 0;
      let strongest = 0;
      for (let i = 0; i < TEXT_BAND_COUNT; i++) {
        const el = textRefs.current[i];
        const weight = textBandWeight(p, i);
        if (weight > maxWeight) {
          maxWeight = weight;
          strongest = i;
        }
        if (!el) continue;
        // War null und bleibt null → nichts schreiben
        if (weight <= 0.004 && textShown.current[i] === 0) continue;
        textShown.current[i] = weight <= 0.004 ? 0 : 1;
        /*
         * Große Serifentypo liest sich schon bei 4 % Deckkraft – ohne
         * Korrektur stünden zwei Zustände als Geisterbild übereinander.
         * Die Gammakurve drückt kleine Gewichte weg, ohne die Überblendung
         * zu einem Schnitt zu machen; unter 12 % wird ganz abgeschaltet.
         */
        /*
         * ... und alle Texte gehen mit dem Auslauf: Sonst stünden die Links
         * des letzten Zustands unsichtbar, aber fokussier- und klickbar
         * unter der deckenden Cream-Fläche (der Schleier ist
         * pointer-events-none). visibility:hidden nimmt sie am Ende auch
         * aus der Tab-Reihenfolge.
         */
        const shown = (weight < 0.12 ? 0 : Math.pow(weight, 1.6)) * (1 - release);
        el.style.opacity = shown.toFixed(3);
        el.style.visibility = shown <= 0.004 ? "hidden" : "visible";
        // Eintritt von unten, Austritt nach oben – die Zustände ziehen durch
        const local = textBandLocal(p, i);
        el.style.transform = `translate3d(0, ${((0.5 - local) * 54).toFixed(1)}px, 0)`;
      }

      // Lesbarkeitsschleier links: bleibt, solange links Text steht
      if (scrimRef.current) {
        scrimRef.current.style.opacity = ((0.35 + maxWeight * 0.65) * (1 - release)).toFixed(3);
      }

      // ---- Arzt-Freisteller: trägt 01–02, weicht den Tafeln ----
      const doctor = LAYERS.doctor(p);
      if (doctorRef.current) {
        doctorRef.current.style.opacity = doctor.toFixed(3);
        doctorRef.current.style.visibility = doctor <= 0.004 ? "hidden" : "visible";
        if (doctor > 0.004) {
          const drift = spanProgress(p, 0, 1);
          const scale = 1.06 - drift * 0.14;
          doctorRef.current.style.transform =
            `translate3d(${(drift * 8 + pointer.current.sx * 0.6).toFixed(2)}%, ${(drift * 4).toFixed(2)}%, 0) ` +
            `scale(${scale.toFixed(3)})`;
        }
      }

      // ---- Leistungs-Korridor ----
      const leistungen = LAYERS.leistungen(p);
      leistungenRef.current?.render(localProgress(p, LEISTUNGEN_INDEX), leistungen, {
        x: pointer.current.sx,
        y: pointer.current.sy,
      });

      // ---- Symptom-Zyklus ----
      symptomeRef.current?.render(localProgress(p, SYMPTOME_INDEX), LAYERS.symptome(p));

      // ---- Team-Ebenen ----
      const teamWeight = LAYERS.team(p);
      teamRef.current?.render(localProgress(p, TEAM_INDEX), teamWeight, {
        x: pointer.current.sx,
        y: pointer.current.sy,
      });
      /*
       * Auf schmalen Schirmen liegt der Text zwangsläufig über den hellen
       * Ebenen (Porträts, Tafeln). Dieser Schleier kommt und geht mit ihnen –
       * er dunkelt nur, wenn wirklich etwas Helles unter der Schrift steht.
       */
      if (veilRef.current) {
        const veil = Math.max(teamWeight, leistungen);
        veilRef.current.style.opacity = veil.toFixed(3);
        veilRef.current.style.visibility = veil <= 0.004 ? "hidden" : "visible";
      }

      // ---- Praxis ----
      const praxis = LAYERS.praxis(p);
      if (praxisRef.current) {
        praxisRef.current.style.opacity = praxis.toFixed(3);
        praxisRef.current.style.visibility = praxis <= 0.004 ? "hidden" : "visible";
        praxisRef.current.style.transform = `translate3d(0, ${((1 - praxis) * 30).toFixed(1)}px, 0)`;
      }

      // ---- Termin-Vorschau: reitet auf dem Auslauf, verblasst nie ----
      const termin = LAYERS.termin(p);
      if (terminRef.current) {
        terminRef.current.style.opacity = termin.toFixed(3);
        terminRef.current.style.visibility = termin <= 0.004 ? "hidden" : "visible";
        terminRef.current.style.transform = `translate3d(0, ${((1 - termin) * 36).toFixed(1)}px, 0)`;
      }

      // ---- Scroll-Hinweis nur ganz am Anfang ----
      if (cueRef.current) {
        cueRef.current.style.opacity = Math.max(0, 1 - p / 0.05).toFixed(3);
      }

      /*
       * Auslauf: Die Bühne wird NICHT skaliert (das legte die Seitenkanten
       * frei), sondern löst sich in genau den Farbton auf, mit dem die
       * Kontakt-Sektion beginnt. Die Termin-Vorschau liegt im DOM über
       * diesem Schleier und bleibt deshalb stehen.
       */
      if (releaseRef.current) {
        releaseRef.current.style.opacity = release.toFixed(3);
        releaseRef.current.style.visibility = release <= 0.004 ? "hidden" : "visible";
      }
      // Leiste, Zähler und Hinweis gehören zur Fahrt – sie gehen mit.
      if (chromeRef.current) {
        const chrome = 1 - release;
        chromeRef.current.style.opacity = chrome.toFixed(3);
        chromeRef.current.style.visibility = chrome <= 0.004 ? "hidden" : "visible";
      }

      // Ab dem Untersuchungsraum ist der Hintergrund hell – Leiste, Zähler
      // und Bahn brauchen dann dunkle Farben. Nur bei Wechsel schreiben.
      const phase = brightness(p) > ROOM_BRIGHT ? "bright" : "dark";
      if (stageRef.current && stageRef.current.dataset.phase !== phase) {
        stageRef.current.dataset.phase = phase;
      }

      // ---- Leiste (React-State nur beim Wechsel) ----
      const nextActive =
        maxWeight > 0.5 ? TEXT_BANDS[strongest].railIndex : activeState(p);
      if (nextActive !== activeRef.current) {
        activeRef.current = nextActive;
        setActive(nextActive);
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

  const goToState = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const top = track.getBoundingClientRect().top + window.scrollY;
      const range = track.offsetHeight - window.innerHeight;
      scrollTo(top + progressForState(index) * range, 0);
    },
    [scrollTo],
  );

  return (
    <section id="hero" aria-label="Einführung" className="relative">
      {/*
        * Ankermarke für /#team. Sie hängt an der SECTION, nicht am Track:
        * Bei reduzierter Bewegung (und ohne JavaScript) ist der Track
        * display:none – ein Anker darin hätte keine Box, /#team liefe ins
        * Leere. An der Section trifft sie in beiden Fassungen den
        * Team-Teil. Bewusst nicht aria-hidden: Die Anker-Navigation setzt
        * den Fokus hierher.
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
        data-header-solid={HEADER_SOLID_AT}
        className="cinema-track relative hidden h-[1200vh] motion-safe:block"
      >
        <div
          ref={stageRef}
          className="on-dark sticky top-0 h-dvh origin-top overflow-hidden bg-deep text-cream"
        >
          {/* 1 – Lichtsequenz: trägt die Zustände 01–05 */}
          <div ref={ambientRef} className="cinema-ambient absolute inset-0">
            <HeroBackground />
            <CanvasSequence ref={sequenceRef} className="absolute inset-0 h-full w-full" />
          </div>

          {/* 2 – der ECHTE Untersuchungsraum: trägt Diagnostik und Behandlung */}
          <div
            ref={examRef}
            className="cinema-exam absolute inset-0"
            style={{ opacity: 0, visibility: "hidden" }}
          >
            <div ref={examSoftRef} className="exam-env-soft absolute inset-0" aria-hidden="true" />
            <div ref={examSharpRef} className="exam-env-sharp absolute inset-0" aria-hidden="true" />
            {/* Vignette hält die linke Textspalte und den unteren Rand ruhig */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(to_right,rgba(23,37,27,0.42)_0%,rgba(23,37,27,0.1)_44%,transparent_65%)]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(to_top,rgba(23,37,27,0.34)_0%,transparent_100%)]"
            />
          </div>

          {/* 3 – Empfangs-Ambiente: trägt Team, Praxis und Termin */}
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

          {/* 5 – Team-Ebenen (erscheinen vor ihrem Zustand, weichen danach zurück) */}
          <TeamStage ref={teamRef} onChapter={onTeamChapter} />

          {/* 6 – durchgehende grüne Bahn */}
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

          {/* 9 – Praxis */}
          <PraxisLayer ref={praxisRef} />

          {/* 10 – Textbänder und ihr Lesbarkeitsschleier (die Konstante links) */}
          <div
            ref={scrimRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-deep via-deep/85 to-transparent md:w-[66%] lg:w-[56%]"
          />
          {CINEMA_TEXTS.map((content, index) => (
            <StateText
              key={TEXT_BANDS[index].id}
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

          {/* Auslauf: löst die Bühne in den Farbton der Kontakt-Sektion auf */}
          <div
            ref={releaseRef}
            aria-hidden="true"
            className="cinema-release pointer-events-none absolute inset-0 bg-cream"
            style={{ opacity: 0, visibility: "hidden" }}
          />

          {/* 11 – Termin-Vorschau: liegt ÜBER dem Auslauf und reitet auf ihm */}
          <TerminLayer ref={terminRef} />

          {/* 12 – Leiste, Team-Unterzähler, Scroll-Hinweis: eine Gruppe,
              damit sie gemeinsam mit dem Auslauf verschwinden */}
          <div ref={chromeRef} className="pointer-events-none absolute inset-0">
            <MasterRail active={active} onSelect={goToState} />

            <p
              aria-hidden={active !== TEAM_INDEX}
              className="cinema-counter pointer-events-none absolute right-5 bottom-8 font-display text-sm text-cream/70 tabular-nums transition-opacity duration-500 md:right-10 md:bottom-10"
              style={{ opacity: active === TEAM_INDEX ? 1 : 0 }}
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
