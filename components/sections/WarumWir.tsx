import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { swipeItem } from "@/components/ui/Swipe";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { cn } from "@/lib/cn";
import { benefits, benefitsIntro } from "@/content/benefits";

/** Warum diese Praxis: editorial gesetzte Benefits auf Deep Green. */
export function WarumWir() {
  return (
    <section
      id="warum"
      aria-labelledby="warum-title"
      data-surface="dark"
      className="on-dark bg-deep"
    >
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-32">
        <Reveal>
          <SectionHeading
            id="warum-title"
            kicker={benefitsIntro.kicker}
            title={benefitsIntro.title}
            onDark
          />
        </Reveal>

        <SwipeRow
          as="ol"
          label={benefitsIntro.kicker}
          count={benefits.length}
          onDark
          className="mt-14 border-t border-white/10 max-md:mt-10 max-md:border-t-0"
        >
          {benefits.map((benefit, index) => (
            <li
              key={benefit.title}
              className={cn(
                "border-b border-white/10 max-md:rounded-2xl max-md:border-0 max-md:bg-white/5 max-md:ring-1 max-md:ring-white/10",
                swipeItem,
              )}
            >
              <Reveal delay={index * 60} swipe>
                <div className="grid items-baseline gap-3 py-7 max-md:px-6 md:grid-cols-[7rem_1fr_1.4fr] md:gap-8 md:py-9">
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
        </SwipeRow>
      </div>
    </section>
  );
}
