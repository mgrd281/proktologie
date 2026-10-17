import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  beschwerden,
  beschwerdenCta,
  beschwerdenIntro,
} from "@/content/beschwerden";

/** Beschwerden: empathische Orientierung, links sticky Intro, rechts Cluster. */
export function Beschwerden() {
  return (
    <section
      id="beschwerden"
      aria-labelledby="beschwerden-title"
      className="bg-cream"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:gap-14 md:px-8 md:py-32 lg:grid-cols-[1fr_1.25fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Reveal>
            <SectionHeading
              id="beschwerden-title"
              kicker={beschwerdenIntro.kicker}
              title={beschwerdenIntro.title}
            />
            <p className="mt-6 leading-relaxed text-ink/70">
              {beschwerdenIntro.lead}
            </p>
            <p className="mt-6 rounded-xl border-l-2 border-primary bg-mist px-5 py-4 text-sm leading-relaxed text-ink/80">
              {beschwerdenIntro.note}
            </p>
          </Reveal>
        </div>

        {/* Vier Karten: auch auf dem Handy eine Liste – zum Wischen sind es zu
            wenige. min-w-0 hält das Rasterkind so schmal wie seine Spalte. */}
        <div className="min-w-0">
          <ul aria-label={beschwerdenIntro.kicker} className="space-y-4">
            {beschwerden.map((cluster, index) => (
              <li key={cluster.id}>
                <Reveal delay={index * 70}>
                  <article className="rounded-2xl bg-white p-7 ring-1 ring-ink/5 max-md:p-6 md:p-8">
                    <h3 className="font-display text-xl font-medium text-ink">
                      {cluster.symptom}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink/70">
                      {cluster.text}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed font-medium text-primary">
                      {cluster.advice}
                    </p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
          <Reveal delay={200}>
            {/* on-dark für den Fokusring; der Knopf ruhig – das Grün gehört der Buchung */}
            <div className="on-dark mt-8 flex flex-col items-start gap-5 rounded-2xl bg-deep p-7 max-md:mt-6 max-md:p-6 md:flex-row md:items-center md:justify-between md:p-8">
              <p className="max-w-md text-sm leading-relaxed text-cream/85">
                {beschwerdenCta.text}
              </p>
              <Button href={beschwerdenCta.href} variant="outline-dark" withArrow className="shrink-0">
                {beschwerdenCta.label}
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
