import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { HeroBeatContent } from "@/content/hero";
import { BeatVisual } from "@/components/hero/beats";

interface HeroBeatProps {
  beat: HeroBeatContent;
  index: number;
  active: boolean;
  /** Nur Beat 1 trägt die H1 der Seite */
  isFirst: boolean;
  /** Zentriertes Abschluss-Layout (letzter Beat) */
  isLast: boolean;
}

/**
 * Eine Beat-Ebene des cinematischen Heros: absolut positioniert, wird von
 * der Scroll-Choreografie über Inline-Styles ein-/ausgeblendet.
 * Inaktive Beats sind `inert` + aria-hidden (nur der aktive ist bedienbar).
 */
export function HeroBeat({ beat, index, active, isFirst, isLast }: HeroBeatProps) {
  const HeadingTag = isFirst ? "h1" : "h2";

  return (
    <div
      data-beat={index}
      className="hero-beat absolute inset-0"
      aria-hidden={!active}
      inert={!active}
    >
      <div
        className={cn(
          // pb-24: hält die linke Spalte über der Kapitel-Navigation
          "mx-auto flex h-full max-w-7xl items-center px-8 pt-20 pb-24",
          isLast && "justify-center text-center",
        )}
      >
        <div
          className={cn(
            "max-w-xl",
            isLast && "flex max-w-2xl flex-col items-center",
          )}
        >
          <p className="flex items-center gap-2.5 text-[13px] font-medium tracking-wide text-cream/75">
            {isFirst && <Icon name="pin" size={15} className="text-accent" />}
            {beat.kicker}
          </p>

          <HeadingTag className="font-display mt-6 text-5xl leading-[1.05] font-medium text-balance xl:text-6xl 2xl:text-7xl">
            <span className="block text-white">{beat.headline[0]}</span>
            <span className="block text-accent">{beat.headline[1]}</span>
          </HeadingTag>

          {isFirst && (
            <p className="mt-7 flex items-center gap-4 text-xl text-cream">
              <span aria-hidden="true" className="h-px w-10 bg-accent/60" />
              Dr. Kai Kunstreich
            </p>
          )}

          <p
            className={cn(
              "mt-6 max-w-md leading-relaxed text-cream/75",
              isLast && "max-w-lg",
            )}
          >
            {beat.text}
          </p>

          {(beat.cta || beat.secondary) && (
            <div
              className={cn(
                "mt-9 flex flex-wrap items-center gap-5",
                isLast && "justify-center",
              )}
            >
              {beat.cta && (
                <Button href={beat.cta.href} withArrow>
                  {beat.cta.label}
                </Button>
              )}
              {beat.secondary && (
                <a
                  href={beat.secondary.href}
                  className="group inline-flex min-h-11 items-center gap-2.5 text-sm font-medium text-cream/85 hover:text-accent"
                >
                  {beat.secondary.href.startsWith("tel:") && (
                    <Icon name="phone" size={16} className="text-accent" />
                  )}
                  {beat.secondary.label}
                  {!beat.secondary.href.startsWith("tel:") && (
                    <Icon
                      name="arrow-down"
                      size={16}
                      className="transition-transform duration-300 group-hover:translate-y-0.5"
                    />
                  )}
                </a>
              )}
            </div>
          )}
        </div>

        {!isLast && (
          <div className="pointer-events-none ml-auto hidden w-[42%] xl:block">
            <BeatVisual beat={beat} />
          </div>
        )}
      </div>
    </div>
  );
}
