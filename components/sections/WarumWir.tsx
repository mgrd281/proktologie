import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { benefits, benefitsIntro } from "@/content/benefits";

/** Warum diese Praxis: editorial gesetzte Benefits auf Deep Green. */
export function WarumWir() {
  return (
    <section
      id="warum"
      aria-labelledby="warum-title"
      className="on-dark bg-deep"
    >
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <SectionHeading
            id="warum-title"
            kicker={benefitsIntro.kicker}
            title={benefitsIntro.title}
            onDark
          />
        </Reveal>

        <ol className="mt-14 border-t border-white/10">
          {benefits.map((benefit, index) => (
            <li key={benefit.title} className="border-b border-white/10">
              <Reveal delay={index * 60}>
                <div className="grid items-baseline gap-3 py-7 md:grid-cols-[7rem_1fr_1.4fr] md:gap-8 md:py-9">
                  <span
                    aria-hidden="true"
                    className="font-display text-3xl font-light text-accent/80 tabular-nums md:text-4xl"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-xl font-medium text-white md:text-2xl">
                    {benefit.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-cream/65 md:text-base">
                    {benefit.text}
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
