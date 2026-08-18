import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface SectionHeadingProps {
  /** Kleiner Kicker über dem Titel */
  kicker: string;
  /** Sektionstitel (h2) */
  title: ReactNode;
  /** id für aria-labelledby der Sektion */
  id: string;
  /** Helle Variante für dunkle Sektionen */
  onDark?: boolean;
  align?: "left" | "center";
  className?: string;
}

/** Einheitlicher Sektionskopf: Kicker in Kapitälchen + Serif-Headline. */
export function SectionHeading({
  kicker,
  title,
  id,
  onDark = false,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold tracking-[0.2em] uppercase",
          onDark ? "text-accent" : "text-primary-deep",
        )}
      >
        {kicker}
      </p>
      <h2
        id={id}
        className={cn(
          "font-display mt-4 text-3xl leading-tight font-medium text-balance md:text-4xl lg:text-[2.75rem]",
          onDark ? "text-white" : "text-ink",
        )}
      >
        {title}
      </h2>
    </div>
  );
}
