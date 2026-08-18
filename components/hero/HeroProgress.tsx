"use client";

import { cn } from "@/lib/cn";
import { heroBeats } from "@/content/hero";

interface HeroProgressProps {
  active: number;
  onSelect: (index: number) => void;
}

/**
 * Sequenz-Navigation des Heros:
 * – rechts oben „0X — Label" (wechselt mit dem aktiven Kapitel)
 * – links unten die beschriftete Kapitelliste (01 Willkommen …
 *   07 Termin); das aktive Kapitel folgt dem aktuellen Frame, der
 *   Füllstand der Linien wird von der Scroll-Choreografie über
 *   `[data-seg-fill]` direkt animiert (scaleX), Klick springt per
 *   Lenis zum Kapitel.
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
        aria-label="Hero-Kapitel"
        className="absolute bottom-10 left-8 hidden lg:block"
      >
        <ol className="flex flex-col gap-1">
          {heroBeats.map((item, index) => {
            const isActive = index === active;
            const isPast = index < active;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-label={`Zu Kapitel ${index + 1}: ${item.label}`}
                  aria-current={isActive ? "true" : undefined}
                  className="group flex min-h-7 items-center gap-3 text-left"
                >
                  <span
                    className={cn(
                      "text-[10px] font-medium tabular-nums transition-colors duration-300",
                      isActive ? "text-accent" : "text-cream/40",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "relative block h-px w-7 overflow-hidden rounded-full transition-colors duration-300",
                      isPast ? "bg-accent/50" : "bg-white/15",
                    )}
                  >
                    <span
                      data-seg-fill={index}
                      className="absolute inset-0 origin-left bg-accent"
                      style={{
                        transform: isPast ? "scaleX(1)" : "scaleX(0)",
                      }}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] tracking-[0.08em] transition-colors duration-300",
                      isActive
                        ? "text-white"
                        : "text-cream/45 group-hover:text-cream/80",
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
