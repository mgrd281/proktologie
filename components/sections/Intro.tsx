import { Reveal } from "@/components/ui/Reveal";
import { intro } from "@/content/sections";

/** Intro / Vertrauen: ruhiger Einstieg nach dem dunklen Hero. */
export function Intro() {
  return (
    <section
      id="vertrauen"
      aria-labelledby="vertrauen-title"
      className="bg-cream"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            {intro.kicker}
          </p>
          <h2
            id="vertrauen-title"
            className="font-display mt-5 text-3xl leading-snug font-medium text-balance text-ink md:text-4xl lg:text-[2.6rem]"
          >
            {intro.lead}
          </h2>
        </Reveal>
        <Reveal delay={120} className="flex flex-col justify-end gap-6">
          {intro.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="leading-relaxed text-ink/75">
              {paragraph}
            </p>
          ))}
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2" aria-label="Unsere Grundsätze">
            {intro.marks.map((mark, index) => (
              <li key={mark} className="flex items-center gap-3 text-sm font-medium text-primary">
                {index > 0 && (
                  <span aria-hidden="true" className="text-ink/30">
                    ·
                  </span>
                )}
                {mark}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
