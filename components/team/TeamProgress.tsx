"use client";

import { cn } from "@/lib/cn";
import { MEMBER_COUNT } from "@/lib/team/scene";

/**
 * Fortschritt der Szene, nach der Vorlage zweigeteilt:
 * rechts eine feine vertikale Skala 01–06, unten rechts der große Zähler
 * „01 / 06". Die Stufen sind Buttons – jedes Mitglied ist damit auch per
 * Tastatur erreichbar, die Szene hängt nicht am Scrollen allein.
 *
 * Auf Mobilgeräten entfällt die Skala; dort bleibt nur der Zähler.
 */

interface TeamProgressProps {
  /** 0 = Intro, 1–6 = Mitglied, 7 = Finale. */
  chapter: number;
  onSelect: (stop: number) => void;
}

export function TeamProgress({ chapter, onSelect }: TeamProgressProps) {
  const memberIndex = Math.min(Math.max(chapter, 1), MEMBER_COUNT);

  return (
    <>
      {/* Vertikale Skala rechts (ab Tablet) */}
      <ol className="pointer-events-auto absolute top-1/2 right-6 hidden -translate-y-1/2 flex-col items-end gap-1 md:flex lg:right-10">
        {Array.from({ length: MEMBER_COUNT }, (_, i) => {
          const stop = i + 1;
          const isActive = chapter === stop;
          return (
            <li key={stop}>
              <button
                type="button"
                onClick={() => onSelect(stop)}
                aria-label={`Mitglied ${stop} von ${MEMBER_COUNT} anzeigen`}
                aria-current={isActive ? "true" : undefined}
                className="group flex h-11 items-center justify-end gap-2.5 pl-6"
              >
                <span
                  className={cn(
                    "text-[11px] tracking-[0.14em] tabular-nums transition-colors duration-500",
                    isActive
                      ? "text-primary-deep"
                      : "text-ink/45 group-hover:text-ink/70",
                  )}
                >
                  {String(stop).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-px origin-right transition-all duration-500 ease-out",
                    isActive
                      ? "w-6 bg-primary"
                      : "w-3 bg-ink/30 group-hover:w-5 group-hover:bg-ink/50",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>

      {/* Großer Zähler – unten rechts (Desktop) bzw. unten links (Mobil) */}
      <p className="pointer-events-none absolute bottom-7 left-5 md:right-10 md:bottom-9 md:left-auto">
        <span className="sr-only">
          Mitglied {memberIndex} von {MEMBER_COUNT}
        </span>
        <span aria-hidden="true" className="font-display text-2xl tabular-nums md:text-3xl">
          <span className={cn("text-ink", chapter === 0 && "text-ink/50")}>
            {String(memberIndex).padStart(2, "0")}
          </span>
          <span className="text-ink/40"> / {String(MEMBER_COUNT).padStart(2, "0")}</span>
        </span>
      </p>
    </>
  );
}
