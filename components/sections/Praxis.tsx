import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MapEmbed } from "@/components/ui/MapEmbed";
import { praxisSection } from "@/content/sections";
import { site } from "@/content/site";

/**
 * Praxis & Standort.
 * Die Google-Maps-Karte lädt erst nach ausdrücklichem Klick
 * (Zwei-Klick-Lösung, siehe components/ui/MapEmbed.tsx).
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

        <div className="mt-14 grid gap-5 md:grid-cols-2">
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
              {/* Routen-Link steht prominent an der Karte darunter */}
              <p className="mt-auto pt-5 text-sm leading-relaxed text-ink/70">
                {site.transitNote}
              </p>
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

        </div>

        <Reveal delay={120}>
          <MapEmbed className="mt-5" />
        </Reveal>
      </div>
    </section>
  );
}
