"use client";

import { cn } from "@/lib/cn";
import { heroBeats } from "@/content/hero";

interface HeroProgressProps {
  active: number;
  onSelect: (index: number) => void;
}

/**
 * Sequenz-Navigation des Heros: die beschriftete Kapitelliste unten links
 * (01 Willkommen … 07 Termin). Das aktive Kapitel folgt dem aktuellen
 * Frame, der Füllstand der Linien wird von der Scroll-Choreografie über
 * `[data-seg-fill]` direkt animiert (scaleX), Klick springt per Lenis
 * zum Kapitel.
 */
export function HeroProgress({ active, onSelect }: HeroProgressProps) {
  return (
    <>
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
