"use client";

import { cn } from "@/lib/cn";
import { RAIL_SCENES } from "@/lib/cinema/frames";

/**
 * Die eine Leiste des Filmwerks: 01 Willkommen … 08 Praxis & Standort
 * (das Termin-Finale ist bewusst KEIN Leistenpunkt – es ist der Auslauf).
 *
 * Sie bleibt über alle Zustände sichtbar und ist damit – neben der grünen
 * Bahn und dem Glow – eines der drei Motive, die den Weg zusammenhalten.
 * Jede Stufe ist ein Button: Die Fahrt lässt sich auch per Tastatur und
 * per Klick anspringen (Lenis scrubbt weich dorthin).
 */

interface MasterRailProps {
  active: number;
  onSelect: (index: number) => void;
}

export function MasterRail({ active, onSelect }: MasterRailProps) {
  return (
    <nav
      aria-label="Kapitel der Einführung"
      className="pointer-events-auto absolute top-1/2 right-4 hidden -translate-y-1/2 lg:right-8 lg:block"
    >
      <ol className="flex flex-col items-end gap-0.5">
        {RAIL_SCENES.map((state, index) => {
          const isActive = index === active;
          const isPast = index < active;
          return (
            <li key={state.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={isActive ? "true" : undefined}
                aria-label={`Zu Kapitel ${index + 1}: ${state.label}`}
                className="group relative flex h-11 items-center justify-end gap-3"
              >
                {/*
                  * Label absolut links des Buttons: Es darf die Hitbox nicht
                  * verbreitern – sonst läge ein unsichtbarer Klickbereich
                  * über der Termin-Vorschau daneben.
                  */}
                <span
                  className={cn(
                    "cinema-rail-label pointer-events-none absolute right-full mr-3 text-[11px] tracking-[0.14em] whitespace-nowrap transition-all duration-500",
                    isActive
                      ? "text-cream opacity-100"
                      : "text-cream/60 opacity-0 group-hover:opacity-100",
                  )}
                >
                  {state.label}
                </span>
                <span
                  className={cn(
                    "cinema-rail-label text-[11px] tabular-nums transition-colors duration-500",
                    isActive ? "text-accent" : isPast ? "text-cream/55" : "text-cream/30",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "cinema-rail-line block h-px transition-all duration-500 ease-out",
                    isActive
                      ? "w-7 bg-accent"
                      : isPast
                        ? "w-4 bg-cream/45"
                        : "w-3 bg-cream/25 group-hover:w-5",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
