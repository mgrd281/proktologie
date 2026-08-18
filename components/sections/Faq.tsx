import { Accordion } from "@/components/ui/Accordion";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { faq, faqIntro } from "@/content/faq";

/** FAQ: häufige Patientenfragen – Text speist auch das FAQPage-JSON-LD. */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-24 md:px-8 md:py-32">
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
        </Reveal>
      </div>
    </section>
  );
}
