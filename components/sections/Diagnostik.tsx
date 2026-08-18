import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { diagnostikIntro, diagnostikSchritte } from "@/content/diagnostik";

/** Diagnostik: der Ablauf in drei ruhigen Schritten. */
export function Diagnostik() {
  return (
    <section
      id="diagnostik"
      aria-labelledby="diagnostik-title"
      className="bg-white"
    >
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <SectionHeading
            id="diagnostik-title"
            kicker={diagnostikIntro.kicker}
            title={diagnostikIntro.title}
            align="center"
          />
          <p className="mx-auto mt-6 max-w-2xl text-center leading-relaxed text-ink/70">
            {diagnostikIntro.lead}
          </p>
        </Reveal>

        <ol className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {diagnostikSchritte.map((schritt, index) => (
            <li key={schritt.step} className="relative">
              <Reveal delay={index * 120}>
                <div className="border-t border-ink/10 pt-7">
                  <span
                    aria-hidden="true"
                    className="font-display text-4xl font-light text-primary"
                  >
                    {schritt.step}
                  </span>
                  <h3 className="font-display mt-4 text-xl font-medium text-ink">
                    {schritt.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/70">
                    {schritt.text}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
