"use client";

import { heroBeats } from "@/content/hero";

interface HeroProgressProps {
  active: number;
  onSelect: (index: number) => void;
}

/**
 * Fortschritts-UI des Heros:
 * – rechts oben „0X — Label" (wechselt mit dem aktiven Beat)
 * – links eine vertikale Rail aus 7 klickbaren Segmenten; der Füllstand
 *   des aktiven Segments wird von der Choreografie über
 *   `[data-seg-fill]`-Elemente direkt animiert.
 */
export function HeroProgress({ active, onSelect }: HeroProgressProps) {
  const beat = heroBeats[active];

  return (
    <>
      <div
        className="pointer-events-none absolute top-24 right-8 hidden items-center gap-4 lg:flex"
        aria-hidden="true"
      >
        <span
          key={active}
          className="beat-label-enter flex items-center gap-4 text-[13px] tracking-wide text-cream/85"
        >
          <span className="font-medium text-accent tabular-nums">
            {String(active + 1).padStart(2, "0")}
          </span>
          <span aria-hidden="true" className="h-px w-14 bg-cream/30" />
          {beat.label}
        </span>
        <span aria-hidden="true" className="h-px w-24 bg-cream/15" />
      </div>

      <nav
        aria-label="Hero-Abschnitte"
        className="absolute bottom-10 left-8 hidden lg:block"
      >
        <ol className="flex flex-col gap-2.5">
          {heroBeats.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`Zu Abschnitt ${index + 1}: ${item.label}`}
                aria-current={index === active ? "true" : undefined}
                className="group flex h-7 w-8 items-center"
              >
                <span
                  className={`relative block h-full w-[3px] overflow-hidden rounded-full transition-colors duration-300 ${
                    index < active ? "bg-accent/60" : "bg-white/15"
                  } group-hover:bg-white/35`}
                >
                  <span
                    data-seg-fill={index}
                    className="absolute inset-0 origin-top bg-accent"
                    style={{ transform: index < active ? "scaleY(1)" : "scaleY(0)" }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
