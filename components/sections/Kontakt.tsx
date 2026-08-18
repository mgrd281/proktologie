import { ContactForm } from "@/components/ui/ContactForm";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { kontakt } from "@/content/sections";
import { site } from "@/content/site";

/** Termin & Kontakt: starker Conversion-Abschluss mit Formular. */
export function Kontakt() {
  return (
    <section id="kontakt" aria-labelledby="kontakt-title" className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <Reveal>
          <SectionHeading
            id="kontakt-title"
            kicker={kontakt.kicker}
            title={kontakt.title}
          />
          <p className="mt-6 max-w-md leading-relaxed text-ink/70">
            {kontakt.text}
          </p>

          <div className="mt-10 space-y-7">
            {site.isPlaceholderData && (
              <p className="text-xs font-medium text-amber-800 italic">
                Telefonnummer und E-Mail-Adresse sind Musterangaben – sie
                werden vor Veröffentlichung ersetzt.
              </p>
            )}
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-ink/70 uppercase">
                {kontakt.phoneLabel}
              </p>
              <a
                href={site.phoneHref}
                className="font-display mt-2 inline-flex items-center gap-3 text-2xl font-medium text-ink hover:text-primary md:text-3xl"
              >
                <Icon name="phone" size={24} className="text-primary" />
                {site.phone}
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-ink/70 uppercase">
                {kontakt.emailLabel}
              </p>
              <a
                href={`mailto:${site.email}`}
                className="mt-2 inline-flex items-center gap-3 text-base font-medium text-ink underline-offset-4 hover:text-primary hover:underline"
              >
                <Icon name="mail" size={20} className="text-primary" />
                {site.email}
              </a>
            </div>
            <p className="flex items-start gap-3 rounded-xl bg-mist px-5 py-4 text-sm leading-relaxed text-ink/70">
              <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-primary" />
              {kontakt.discretionNote}
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-2xl bg-cream p-7 ring-1 ring-ink/5 md:p-9">
            <h3 className="font-display text-xl font-medium text-ink">
              {kontakt.form.title}
            </h3>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
