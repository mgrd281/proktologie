import { Accordion } from "@/components/ui/Accordion";
import { EmergencyLine } from "@/components/ui/EmergencyLine";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { faq, faqIntro } from "@/content/faq";
import { site } from "@/content/site";

/** FAQ: häufige Patientenfragen – Text speist auch das FAQPage-JSON-LD. */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-32">
        <Reveal>
          <SectionHeading
            id="faq-title"
            kicker={faqIntro.kicker}
            title={faqIntro.title}
            align="center"
          />
        </Reveal>
        <Reveal delay={120} className="mt-14">
          <Accordion items={[...faq]} />
          {/* Nicht dabei? Das Telefon – und nach Feierabend die Notfallnummern */}
          <div className="mt-8 text-center">
            <p className="text-sm leading-relaxed text-ink/75">
              {faqIntro.phoneLead}{" "}
              <a
                href={site.phoneHref}
                className="font-medium whitespace-nowrap text-primary-deep underline underline-offset-4 hover:text-primary max-md:inline-flex max-md:min-h-11 max-md:items-center"
              >
                {site.phone}
              </a>
            </p>
            <EmergencyLine className="mt-2" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
