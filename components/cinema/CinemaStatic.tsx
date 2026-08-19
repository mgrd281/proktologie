import { HeroStatic } from "@/components/hero/HeroStatic";
import { TeamStatic } from "@/components/team/TeamStatic";
import { intro } from "@/content/sections";

/**
 * Die Fahrt ohne Fahrt: bei prefers-reduced-motion und ohne JavaScript.
 *
 * Statt der Kamerafahrt stehen dieselben Inhalte ruhig untereinander –
 * die Eröffnung mit Arzt und Wegen, das Praxis-Intro (das auf der
 * bewegten Seite Zustand 02 ist und sonst nirgends mehr steht) und das
 * Praxisteam als Editorial-Layout. Nichts hängt an Bewegung; die
 * ausführlichen Sektionen folgen wie gewohnt darunter.
 */
export function CinemaStatic() {
  return (
    <>
      <HeroStatic />
      <div className="bg-cream">
        <section aria-labelledby="vertrauen-still-title">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:px-8 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-primary-deep uppercase">
                {intro.kicker}
              </p>
              <h2
                id="vertrauen-still-title"
                className="font-display mt-5 text-3xl leading-snug font-medium text-balance text-ink md:text-4xl"
              >
                {intro.lead}
              </h2>
            </div>
            <div className="flex flex-col justify-end gap-6">
              {intro.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="leading-relaxed text-ink/75">
                  {paragraph}
                </p>
              ))}
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2" aria-label="Unsere Grundsätze">
                {intro.marks.map((mark) => (
                  <li
                    key={mark}
                    className="rounded-full border border-primary/25 px-4 py-1.5 text-xs font-medium tracking-wide text-primary-deep"
                  >
                    {mark}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <TeamStatic />
      </div>
    </>
  );
}
