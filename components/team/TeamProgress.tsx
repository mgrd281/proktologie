"use client";

import { cn } from "@/lib/cn";
import { MEMBER_COUNT } from "@/lib/team/scene";

/**
 * Fortschritt der Szene: „01 / 06" plus eine feine Skala.
 * Die Stufen sind Buttons – damit ist jedes Mitglied auch per Tastatur
 * erreichbar und die Szene nicht ausschließlich scrollbar.
 */

interface TeamProgressProps {
  /** 0 = Intro, 1–6 = Mitglied, 7 = Finale. */
  chapter: number;
  onSelect: (stop: number) => void;
}

export function TeamProgress({ chapter, onSelect }: TeamProgressProps) {
  const memberIndex = Math.min(Math.max(chapter, 1), MEMBER_COUNT);

  return (
    <div className="pointer-events-auto absolute bottom-8 left-5 flex items-center gap-4 md:bottom-10 md:left-10">
      <p className="font-display text-sm text-cream tabular-nums">
        <span className={cn(chapter === 0 && "opacity-45")}>
          {String(memberIndex).padStart(2, "0")}
        </span>
        <span className="text-cream/40"> / {String(MEMBER_COUNT).padStart(2, "0")}</span>
      </p>

      <ol className="flex items-center gap-1.5">
        {Array.from({ length: MEMBER_COUNT }, (_, i) => {
          const stop = i + 1;
          const isActive = chapter === stop;
          const isPast = chapter > stop;
          return (
            <li key={stop}>
              <button
                type="button"
                onClick={() => onSelect(stop)}
                aria-label={`Mitglied ${stop} von ${MEMBER_COUNT} anzeigen`}
                aria-current={isActive ? "true" : undefined}
                className="group flex h-11 w-4 items-center justify-center"
              >
                <span
                  className={cn(
                    "block h-px w-full origin-center transition-[transform,background-color] duration-500 ease-out group-hover:scale-y-[3]",
                    isActive
                      ? "scale-y-[3] bg-accent"
                      : isPast
                        ? "bg-cream/55"
                        : "bg-cream/25",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
