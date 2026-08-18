import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { forwardRef } from "react";

/**
 * Der Textblock EINES Zustands der Kamerafahrt.
 *
 * Alle sieben Zustände tragen denselben Aufbau – Eyebrow mit Linie, große
 * Headline, Fließtext, optionale Stichpunkte und Wege. Die dunkle Spalte
 * links ist die Konstante der ganzen Fahrt: Rechts wechselt die Welt (Licht,
 * Empfangsraum, Porträts), links bleibt der Ort, an dem gesprochen wird.
 * Das hält auch den Kontrast stabil, während der Hintergrund von dunkel
 * nach hell überblendet.
 *
 * Die Sichtbarkeit schreibt ausschließlich die MasterSequence per Ref.
 */

export interface StateTextContent {
  kicker: string;
  /**
   * Headline-Zeilen wie in content/hero.ts. Zwei Zeilen → die zweite trägt
   * den Akzent; eine Zeile → sie bekommt den grünen Schlusspunkt.
   */
  headline: string[];
  text: string;
  /** Stichpunkte mit kurzer Erläuterung (aus den Beats übernommen). */
  items?: { title: string; note: string }[];
  cta?: { label: string; href: string };
  secondary?: { label: string; href: string };
}

interface StateTextProps {
  content: StateTextContent;
  /** Erster Zustand bekommt die H1, alle weiteren H2. */
  isFirst?: boolean;
  className?: string;
}

export const StateText = forwardRef<HTMLDivElement, StateTextProps>(
  function StateText({ content, isFirst = false, className }, ref) {
    const Heading = isFirst ? "h1" : "h2";

    return (
      <div
        ref={ref}
        className={cn("cinema-text absolute inset-y-0 left-0 flex items-center", className)}
        style={{ opacity: 0, visibility: "hidden" }}
      >
        <div className="w-full max-w-xl px-5 py-16 md:pl-10 lg:pl-16">
          <p className="flex items-center gap-4 text-xs font-semibold tracking-[0.24em] text-accent uppercase">
            {content.kicker}
            <span aria-hidden="true" className="h-px w-16 bg-accent/45" />
          </p>

          <Heading className="font-display mt-5 text-4xl leading-[1.05] font-medium text-cream md:text-6xl">
            {content.headline[0]}
            {content.headline[1] ? (
              <span className="block text-accent">{content.headline[1]}</span>
            ) : (
              <span className="text-accent">.</span>
            )}
          </Heading>

          <p className="mt-6 max-w-md text-sm leading-relaxed text-cream/75 md:text-base">
            {content.text}
          </p>

          {content.items && content.items.length > 0 && (
            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {content.items.map((item) => (
                <li key={item.title} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1 shrink-0 rounded-full bg-accent"
                  />
                  <span className="text-sm leading-snug text-cream/75">
                    <span className="font-medium text-cream">{item.title}</span>
                    <span className="block text-xs text-cream/50">{item.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {(content.cta || content.secondary) && (
            <div className="mt-9 flex flex-wrap items-center gap-4">
              {content.cta && (
                <Link
                  href={content.cta.href}
                  className="inline-flex min-h-12 items-center gap-3 rounded-full bg-accent px-7 text-sm font-semibold text-deep transition-colors duration-300 hover:bg-[#76a81f]"
                >
                  {content.cta.label}
                  <Icon name="arrow-right" size={16} />
                </Link>
              )}
              {content.secondary && (
                <Link
                  href={content.secondary.href}
                  className="inline-flex min-h-12 items-center gap-3 rounded-full border border-cream/35 px-7 text-xs font-semibold tracking-[0.16em] text-cream uppercase transition-colors duration-300 hover:border-accent hover:text-accent"
                >
                  {content.secondary.label}
                  <Icon name="arrow-right" size={16} />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);
