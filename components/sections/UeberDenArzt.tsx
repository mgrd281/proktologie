import { DoctorPortrait } from "@/components/ui/DoctorPortrait";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { arzt } from "@/content/arzt";

/** Über den Arzt: Porträt + Haltung + Vita (Platzhalter für echte Stationen). */
export function UeberDenArzt() {
  return (
    <section
      id="ueber-den-arzt"
      aria-labelledby="ueber-den-arzt-title"
      className="bg-cream"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <Reveal>
          <div className="relative mx-auto max-w-md lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute -top-4 -left-4 h-full w-full rounded-2xl border border-primary/25"
            />
            <DoctorPortrait
              alt={arzt.portraitAlt}
              className="relative aspect-[3/4] rounded-2xl shadow-[0_30px_60px_-30px_rgba(23,37,27,0.5)]"
            />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary-deep uppercase">
            {arzt.kicker}
          </p>
          <h2
            id="ueber-den-arzt-title"
            className="font-display mt-4 text-3xl leading-tight font-medium text-ink md:text-4xl lg:text-[2.75rem]"
          >
            {arzt.name}
          </h2>
          <p className="mt-3 text-sm font-medium text-ink/70">{arzt.role}</p>

          <div className="mt-7 space-y-5">
            {arzt.philosophy.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="leading-relaxed text-ink/75">
                {paragraph}
              </p>
            ))}
          </div>

          <ul className="mt-8 space-y-3 border-t border-ink/10 pt-7">
            {arzt.vita.map((station) => (
              <li key={station} className="flex items-start gap-3 text-sm text-ink/70">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" />
                {station}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
