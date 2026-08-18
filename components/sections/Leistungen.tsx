import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { leistungen, leistungenIntro } from "@/content/leistungen";

/** Leistungsspektrum als ruhiges Karten-Grid. */
export function Leistungen() {
  return (
    <section
      id="leistungen"
      aria-labelledby="leistungen-title"
      className="bg-mist"
    >
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <SectionHeading
            id="leistungen-title"
            kicker={leistungenIntro.kicker}
            title={leistungenIntro.title}
          />
          <p className="mt-6 max-w-2xl leading-relaxed text-ink/70">
            {leistungenIntro.text}
          </p>
        </Reveal>

        <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {leistungen.map((leistung, index) => (
            <li key={leistung.slug} className="h-full">
              <Reveal delay={(index % 3) * 80} className="h-full">
                <div className="group flex h-full flex-col rounded-2xl bg-white p-7 ring-1 ring-ink/5 transition-shadow duration-300 hover:shadow-[0_16px_40px_-20px_rgba(23,37,27,0.35)]">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                    <Icon name={leistung.icon} size={22} />
                  </span>
                  <h3 className="font-display mt-6 text-xl font-medium text-ink">
                    {leistung.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/70">
                    {leistung.teaser}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
