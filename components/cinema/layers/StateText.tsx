import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { forwardRef, type CSSProperties, type ReactNode } from "react";

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
 * Die Sichtbarkeit schreibt ausschließlich die MasterSequence per Ref;
 * `initialStyle` ist ihr Startbild im ausgelieferten HTML.
 *
 * Wege sind einfache Links (kein next/link): Nur so laufen sie über die
 * Anker-Logik im LenisProvider – Sprung ohne Durchspulen, Abstand unter dem
 * Header, Fokus auf dem Ziel.
 */

export interface StateTextContent {
  kicker: string;
  /**
   * Headline-Zeilen wie in content/hero.ts. Zwei Zeilen → die zweite trägt
   * den Akzent; eine Zeile → sie bekommt den grünen Schlusspunkt.
   */
  headline: string[];
  text: string;
  /** Optionaler zweiter Absatz (etwa der zweite Intro-Absatz in Zustand 02). */
  secondaryText?: string;
  /** Stichpunkte mit kurzer Erläuterung (aus den Beats übernommen). */
  items?: { title: string; note: string }[];
  cta?: { label: string; href: string };
  secondary?: { label: string; href: string };
  /**
   * "md" für Aussage-Headlines in Satzlänge (etwa das Praxis-Intro):
   * kleinere Stufe, damit der Satz als Satz lesbar bleibt statt als
   * vierzeiliger Displayblock.
   */
  headlineSize?: "md";
}

interface StateTextProps {
  content: StateTextContent;
  /** Erster Zustand bekommt die H1, alle weiteren H2. */
  isFirst?: boolean;
  /** Startbild der Fahrt (Frame 1); Standard: unsichtbar. */
  initialStyle?: CSSProperties;
  /**
   * Zeile unter den Wegen (etwa „Freie Termine ab …“). Sie liegt absolut
   * darunter: Erscheint sie nach dem Laden, rückt nichts.
   */
  ctaNote?: ReactNode;
  className?: string;
}

export const StateText = forwardRef<HTMLDivElement, StateTextProps>(
  function StateText({ content, isFirst = false, initialStyle, ctaNote, className }, ref) {
    const Heading = isFirst ? "h1" : "h2";

    return (
      <div
        ref={ref}
        className={cn("cinema-text absolute inset-y-0 left-0 flex items-center", className)}
        style={initialStyle ?? { opacity: 0, visibility: "hidden" }}
      >
        {/* Niedrige Schirme (unter 700 px, etwa kleine iPhones mit
            Browserleiste): engere Abstände, damit Kicker und letzte Zeile
            zwischen Kopf und Leiste passen. */}
        <div className="w-full max-w-xl px-5 pt-20 pb-28 md:py-16 md:pl-10 lg:pl-16 [@media(max-height:699px)]:pb-20 [@media(max-height:599px)]:pt-16">
          <p className="flex items-center gap-4 text-xs font-semibold tracking-[0.24em] text-accent uppercase">
            {content.kicker}
            <span aria-hidden="true" className="h-px w-16 bg-accent/45" />
          </p>

          <Heading
            className={cn(
              "font-display mt-5 leading-[1.08] font-medium text-cream [@media(max-height:599px)]:mt-3",
              content.headlineSize === "md"
                ? "text-[1.7rem] md:text-4xl lg:text-[2.6rem] [@media(max-height:599px)]:text-2xl"
                : "text-4xl leading-[1.05] md:text-6xl",
            )}
          >
            {content.headline[0]}
            {content.headline[1] ? (
              <span className="block text-accent">{content.headline[1]}</span>
            ) : (
              <span className="text-accent">.</span>
            )}
          </Heading>

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-cream/85 md:text-base md:text-cream/75 [@media(max-height:599px)]:mt-4 [@media(max-height:599px)]:text-sm">
            {content.text}
          </p>

          {content.secondaryText && (
            <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/75 md:text-cream/65 [@media(max-height:599px)]:mt-2">
              {content.secondaryText}
            </p>
          )}

          {content.items && content.items.length > 0 && (
            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2 [@media(max-height:599px)]:mt-4">
              {content.items.map((item) => (
                <li key={item.title} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1 shrink-0 rounded-full bg-accent"
                  />
                  <span className="text-sm leading-snug text-cream/75">
                    <span className="font-medium text-cream">{item.title}</span>
                    {/* Niedrige Schirme (kleine Handys): nur die Stichworte –
                        sonst rutschen Überschrift und Knopf aus dem Bild. Die
                        Erläuterungen stehen unten auf der Seite vollständig. */}
                    <span className="block text-xs text-cream/65 md:text-cream/50 [@media(max-height:699px)]:hidden">
                      {item.note}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {(content.cta || content.secondary) && (
            <div className="relative mt-9 flex flex-wrap items-center gap-4 [@media(max-height:599px)]:mt-6">
              {content.cta && (
                <a
                  href={content.cta.href}
                  className="inline-flex min-h-12 items-center gap-3 rounded-full bg-accent px-7 text-sm font-semibold text-deep transition-colors duration-300 hover:bg-[#76a81f]"
                >
                  {content.cta.label}
                  <Icon name="arrow-right" size={16} />
                </a>
              )}
              {content.secondary && (
                <a
                  href={content.secondary.href}
                  className="inline-flex min-h-12 items-center gap-3 rounded-full border border-cream/35 px-7 text-xs font-semibold tracking-[0.16em] text-cream uppercase transition-colors duration-300 hover:border-accent hover:text-accent"
                >
                  {content.secondary.label}
                  <Icon name="arrow-right" size={16} />
                </a>
              )}
              {ctaNote && <div className="absolute top-full left-0 mt-4">{ctaNote}</div>}
            </div>
          )}
        </div>
      </div>
    );
  },
);
