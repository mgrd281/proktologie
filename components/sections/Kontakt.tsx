import { BookingCard } from "@/components/booking/BookingCard";
import { CallbackDisclosure } from "@/components/booking/CallbackDisclosure";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { terminSection } from "@/content/booking";
import { site } from "@/content/site";

/**
 * Termin-Sektion: links Intro + Kontakt-Alternativen (Telefon, Doctolib,
 * Standort, Akut-Hinweis, Rückruf), rechts die dominierende Booking-Karte
 * mit dem 5-Schritte-Flow. Die Karte existiert genau EINMAL im DOM
 * (keine doppelten IDs/States) – auf Mobilgeräten rückt sie per
 * Grid-Platzierung direkt hinter das Intro, auf Desktop in die rechte
 * Spalte über beide Zeilen.
 */
export function Kontakt() {
  return (
    <section id="kontakt" aria-labelledby="kontakt-title" className="bg-cream">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-[1fr_1.35fr] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
        <Reveal className="lg:col-start-1 lg:row-start-1">
          <SectionHeading
            id="kontakt-title"
            kicker={terminSection.kicker}
            title={terminSection.title}
          />
          <p className="mt-6 max-w-md leading-relaxed text-ink/70">
            {terminSection.text}
          </p>
        </Reveal>

        <Reveal
          delay={120}
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <BookingCard />
        </Reveal>

        <Reveal delay={140} className="lg:col-start-1 lg:row-start-2">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-ink/70 uppercase">
                {terminSection.phoneLabel}
              </p>
              <a
                href={site.phoneHref}
                className="font-display mt-2 inline-flex items-center gap-3 text-2xl font-medium text-ink hover:text-primary md:text-3xl"
              >
                <Icon name="phone" size={22} className="text-primary" />
                {site.phone}
              </a>
            </div>

            {/* Doctolib nur zeigen, wenn die echte Profil-URL konfiguriert ist */}
            {site.doctolibConfigured && (
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-ink/70 uppercase">
                  {terminSection.doctolibLabel}
                </p>
                <a
                  href={site.doctolibUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center gap-2.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {terminSection.doctolibNote}
                  <Icon name="arrow-right" size={15} className="shrink-0" />
                </a>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-ink/70 uppercase">
                {terminSection.locationLabel}
              </p>
              <p className="mt-2 flex items-start gap-2.5 text-sm leading-relaxed text-ink/70">
                <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  {site.name} · {site.doctor}
                  <br />
                  {site.address.street}, {site.address.zip} {site.address.city}
                </span>
              </p>
            </div>

            <p className="flex items-start gap-2.5 rounded-xl bg-mist px-4 py-3.5 text-sm leading-relaxed text-ink/75">
              <Icon name="pulse" size={16} className="mt-0.5 shrink-0 text-primary" />
              {terminSection.acuteNote}
            </p>

            <CallbackDisclosure />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
