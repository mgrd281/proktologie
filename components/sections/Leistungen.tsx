import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { swipeItem } from "@/components/ui/Swipe";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { cn } from "@/lib/cn";
import { leistungen, leistungenIntro } from "@/content/leistungen";

/** Leistungsspektrum als ruhiges Karten-Grid. */
export function Leistungen() {
  return (
    <section
      id="leistungen"
      aria-labelledby="leistungen-title"
      className="bg-mist"
    >
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-32">
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

        <SwipeRow
          label={leistungenIntro.kicker}
          count={leistungen.length}
          className="mt-14 grid gap-5 max-md:mt-10 md:grid-cols-2 lg:grid-cols-3"
        >
          {leistungen.map((leistung, index) => (
            <li key={leistung.slug} className={cn("h-full", swipeItem)}>
              <Reveal delay={(index % 3) * 80} swipe className="h-full">
                {/* Keine Schein-Hover: Die Karte ist kein Link */}
                <div className="flex h-full flex-col rounded-2xl bg-white p-7 ring-1 ring-ink/5">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
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
        </SwipeRow>
      </div>
    </section>
  );
}
