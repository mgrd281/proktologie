import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TeamPhoto } from "@/components/ui/TeamPhoto";
import { ctaLabel } from "@/content/navigation";
import { praxisSection } from "@/content/sections";
import { site } from "@/content/site";

/**
 * Praxis & Standort.
 * Bewusst KEIN eingebettetes Karten-Widget (Datenschutz): stattdessen ein
 * gestaltetes Panel mit externem Routen-Link.
 */
export function Praxis() {
  return (
    <section id="praxis" aria-labelledby="praxis-title" className="bg-mist">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <SectionHeading
            id="praxis-title"
            kicker={praxisSection.kicker}
            title={praxisSection.title}
          />
          <p className="mt-6 max-w-2xl leading-relaxed text-ink/70">
            {praxisSection.text}
          </p>
        </Reveal>

        <Reveal delay={60}>
          <TeamPhoto className="mt-14" />
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-[1fr_1fr_1.3fr]">
          <Reveal className="h-full">
            <div className="flex h-full flex-col rounded-2xl bg-white p-7 ring-1 ring-ink/5 md:p-8">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name="pin" size={20} />
              </span>
              <h3 className="font-display mt-5 text-lg font-medium text-ink">
                {praxisSection.addressTitle}
              </h3>
              <address className="mt-3 text-sm leading-relaxed text-ink/70 not-italic">
                {site.name}
                <br />
                {site.doctor}
                <br />
                {site.address.street}
                <br />
                {site.address.zip} {site.address.city} – {site.address.district}
              </address>
              <a
                href={site.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {praxisSection.mapsLabel}
                <Icon name="arrow-right" size={16} />
              </a>
            </div>
          </Reveal>

          <Reveal delay={80} className="h-full">
            <div className="flex h-full flex-col rounded-2xl bg-white p-7 ring-1 ring-ink/5 md:p-8">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name="clock" size={20} />
              </span>
              <h3 className="font-display mt-5 text-lg font-medium text-ink">
                {praxisSection.hoursTitle}
              </h3>
              <dl className="mt-3 space-y-2 text-sm text-ink/70">
                {site.hours.map((entry) => (
                  <div key={entry.days} className="flex justify-between gap-4">
                    <dt>{entry.days}</dt>
                    <dd className="text-right font-medium text-ink/80">
                      {entry.time}
                    </dd>
                  </div>
                ))}
              </dl>
              {site.isPlaceholderData && (
                <p className="mt-4 text-xs font-medium text-amber-800 italic">
                  {praxisSection.hoursPlaceholderNote}
                </p>
              )}
              <p className="mt-auto pt-5 text-sm leading-relaxed text-ink/70">
                {praxisSection.hoursNote}
              </p>
            </div>
          </Reveal>

          <Reveal delay={160} className="h-full">
            {/* Karten-Platzhalter: stilisiertes Straßenraster statt Embed */}
            <div className="on-dark relative flex h-full min-h-72 flex-col justify-end overflow-hidden rounded-2xl bg-deep p-7 md:p-8">
              <svg
                viewBox="0 0 600 400"
                className="absolute inset-0 h-full w-full opacity-40"
                aria-hidden="true"
                focusable="false"
                preserveAspectRatio="xMidYMid slice"
              >
                <g stroke="#527A32" strokeWidth="1.2" fill="none">
                  <path d="M0 90 C 150 70, 320 120, 600 80" />
                  <path d="M0 190 C 180 160, 380 220, 600 180" />
                  <path d="M0 300 C 200 270, 400 330, 600 290" />
                  <path d="M110 0 C 130 140, 90 280, 120 400" />
                  <path d="M300 0 C 320 130, 280 260, 310 400" />
                  <path d="M480 0 C 500 150, 460 280, 490 400" />
                </g>
                <g stroke="#86BC23" strokeOpacity="0.4" strokeWidth="1">
                  <path d="M0 145 C 170 120, 360 170, 600 130" fill="none" />
                  <path d="M200 0 C 220 140, 180 270, 210 400" fill="none" />
                </g>
              </svg>
              <span
                aria-hidden="true"
                className="absolute top-[38%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-accent text-deep shadow-lg">
                  <Icon name="pin" size={20} />
                </span>
                <span className="size-2 rounded-full bg-accent/40" />
              </span>
              <div className="relative">
                <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
                  {site.district}, {site.city}
                </p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-cream/75">
                  Zentral gelegen und gut erreichbar – wir freuen uns auf Ihren
                  Besuch.
                </p>
                <Button href="/#kontakt" withArrow className="mt-6">
                  {ctaLabel}
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
