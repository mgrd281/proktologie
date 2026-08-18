"use client";

import { HeroBackground } from "@/components/hero/HeroBackground";
import { HeroBeat } from "@/components/hero/HeroBeat";
import { HeroProgress } from "@/components/hero/HeroProgress";
import { DoctorPortrait } from "@/components/ui/DoctorPortrait";
import { arzt } from "@/content/arzt";
import { heroBeats } from "@/content/hero";
import { useScrollProgress } from "@/lib/hooks/useScrollProgress";
import { useLenis } from "@/providers/LenisProvider";
import { useCallback, useEffect, useRef, useState } from "react";

const N = heroBeats.length;
const SEG = 1 / N;
/** Anteil des Beat-Segments für Ein-/Ausblendung */
const FADE_IN_END = 0.22;
const FADE_OUT_START = 0.8;

/** Linear interpolieren, t auf [a,b] geklemmt. */
function ramp(v: number, a: number, b: number, from: number, to: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return from + (to - from) * t;
}

/**
 * Cinematischer Desktop-Hero: 700vh-Track mit sticky 100dvh-Stage.
 * Der Scroll-Fortschritt (0–1) wird auf 7 Erzähl-Beats abgebildet;
 * Ein-/Ausblendungen laufen ausschließlich über opacity/transform
 * (compositor-only) und werden pro Frame direkt per Ref geschrieben –
 * React rendert nur beim diskreten Beat-Wechsel (max. 7×).
 */
export function HeroCinematic() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLElement[]>([]);
  const fillsRef = useRef<HTMLElement[]>([]);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const { scrollTo } = useLenis();

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    layersRef.current = Array.from(
      stage.querySelectorAll<HTMLElement>(".hero-beat"),
    );
    fillsRef.current = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-seg-fill]"),
    );
  }, []);

  const onProgress = useCallback((p: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--hp", p.toFixed(4));

    layersRef.current.forEach((layer, i) => {
      const local = (p - i * SEG) / SEG;
      const fadeIn = i === 0 ? 1 : ramp(local, 0, FADE_IN_END, 0, 1);
      const fadeOut = i === N - 1 ? 1 : ramp(local, FADE_OUT_START, 1, 1, 0);
      const opacity = Math.min(fadeIn, fadeOut);
      const y =
        (i === 0 ? 0 : ramp(local, 0, FADE_IN_END, 40, 0)) +
        (i === N - 1 ? 0 : ramp(local, FADE_OUT_START, 1, 0, -40));
      layer.style.opacity = opacity.toFixed(3);
      layer.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      layer.style.visibility = opacity <= 0.001 ? "hidden" : "visible";
    });

    // Porträt: während der Beats 1–2 sichtbar, mit subtilem Zoom
    const portrait = portraitRef.current;
    if (portrait) {
      const opacity = ramp(p, SEG * 1.7, SEG * 2.15, 1, 0);
      const scale = 1 + Math.min(p / (2 * SEG), 1) * 0.06;
      portrait.style.opacity = opacity.toFixed(3);
      portrait.style.transform = `scale(${scale.toFixed(4)})`;
      portrait.style.visibility = opacity <= 0.001 ? "hidden" : "visible";
    }

    // Scroll-Cue blendet mit dem ersten Scrollen aus
    if (cueRef.current) {
      cueRef.current.style.opacity = ramp(p, 0, SEG * 0.6, 1, 0).toFixed(3);
    }

    // Füllstand der Rail-Segmente
    fillsRef.current.forEach((fill, i) => {
      const localFill = Math.min(1, Math.max(0, (p - i * SEG) / SEG));
      fill.style.transform = `scaleY(${localFill.toFixed(3)})`;
    });

    // Diskreter Beat-Wechsel -> React-State (Indikator, inert, aria)
    const next = Math.min(N - 1, Math.floor(p * N + 0.0001));
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
    }
  }, []);

  useScrollProgress(trackRef, onProgress);

  const handleSelect = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const top = track.getBoundingClientRect().top + window.scrollY;
      const range = track.offsetHeight - window.innerHeight;
      scrollTo(top + (index + 0.5) * SEG * range, 0);
    },
    [scrollTo],
  );

  return (
    <div ref={trackRef} className="relative h-[700vh]">
      <div
        ref={stageRef}
        className="on-dark sticky top-0 h-dvh overflow-hidden bg-deep text-cream"
      >
        {/*
         * Ebenen-Aufbau (unten → oben):
         * 1. HeroBackground – Klinik-Ambiente, später durch die
         *    Canvas-Bildsequenz ersetzbar (eigene Komponente)
         * 2. Beat-Ebenen – Typografie und Beat-Visuals
         * 3. Arzt-Freisteller – unabhängige Ebene, separat animierbar
         *    (Parallax/Fade läuft bereits über portraitRef)
         * 4. Progress-Rail, Scroll-Cue (Interface) – der fixe Header
         *    liegt ohnehin darüber
         */}
        <HeroBackground />

        {heroBeats.map((beat, index) => (
          <HeroBeat
            key={beat.id}
            beat={beat}
            index={index}
            active={index === active}
            isFirst={index === 0}
            isLast={index === N - 1}
          />
        ))}

        {/* Freigestellter Arzt (Beats 1–2), bottom-anchored rechts */}
        <div
          ref={portraitRef}
          className="pointer-events-none absolute inset-y-0 right-0 w-[46%] origin-bottom will-change-[opacity,transform] xl:right-[2%] xl:w-[42%]"
        >
          <DoctorPortrait
            alt={arzt.portraitAlt}
            priority
            variant="cutout"
            className="h-full w-full pt-16"
          />
        </div>

        <HeroProgress active={active} onSelect={handleSelect} />

        <div
          ref={cueRef}
          aria-hidden="true"
          className="absolute bottom-10 left-24 flex items-center gap-4"
        >
          <span className="flex h-10 w-6 items-start justify-center rounded-full border border-cream/30 pt-1.5">
            <span className="animate-scroll-cue block h-2 w-0.5 rounded-full bg-accent" />
          </span>
          <span className="text-xs tracking-[0.18em] text-cream/55 uppercase">
            Scrollen zum Entdecken
          </span>
        </div>
      </div>
    </div>
  );
}
