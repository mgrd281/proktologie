import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { TeamPhoto } from "@/components/ui/TeamPhoto";
import { cn } from "@/lib/cn";
import {
  TEAM_IMAGE_HEIGHT,
  TEAM_IMAGE_WIDTH,
  TEAM_PLACEHOLDER_LABEL,
  team,
  teamIntro,
  teamOutro,
} from "@/content/team";

/**
 * Variante ohne Scroll-Kopplung: prefers-reduced-motion und Seiten ohne
 * JavaScript. Bewusst KEIN 3×2-Raster – die Porträts stehen versetzt in
 * zwei Bahnen, wie ein ruhiges Editorial. Gleiche Bilder, gleiche
 * neutralen Angaben, nur ohne Bewegung.
 */

/** Vertikaler Versatz je Spalte – bricht die Rasteranmutung. */
const OFFSET = ["md:mt-0", "md:mt-14", "md:mt-6", "md:mt-20", "md:mt-4", "md:mt-16"];

export function TeamStatic() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
      <Reveal>
        <p className="text-xs font-semibold tracking-[0.22em] text-primary-deep uppercase">
          {teamIntro.kicker}
        </p>
        <h2 className="font-display mt-4 max-w-2xl text-4xl leading-[1.08] font-medium text-ink md:text-5xl">
          {teamIntro.title}
        </h2>
        <p className="mt-6 max-w-2xl leading-relaxed text-ink/70">{teamIntro.text}</p>
      </Reveal>

      <Reveal delay={60}>
        <TeamPhoto className="mt-14" />
      </Reveal>

      <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 md:gap-x-8">
        {team.map((member, index) => (
          <li key={member.id} className={cn(OFFSET[index])}>
            <Reveal delay={(index % 3) * 70}>
              <figure className="relative overflow-hidden rounded-[24px] bg-mist ring-1 ring-ink/8">
                {/* eslint-disable-next-line @next/next/no-img-element -- statischer Export ohne Bildoptimierungs-Server */}
                <img
                  src={`${member.image}-840.webp`}
                  srcSet={`${member.image}-420.webp 420w, ${member.image}-840.webp 840w`}
                  sizes="(min-width: 768px) 30vw, 45vw"
                  alt={member.alt}
                  width={TEAM_IMAGE_WIDTH}
                  height={TEAM_IMAGE_HEIGHT}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-[4/5] w-full object-cover object-top"
                />
                <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-deep/75 via-deep/30 to-transparent px-4 pt-10 pb-3.5">
                  {member.name ? (
                    <span className="font-display truncate text-sm font-medium text-cream">
                      {member.name}
                      {member.role && (
                        <span className="block text-xs font-normal text-cream/75">
                          {member.role}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold tracking-[0.2em] text-cream/80 uppercase">
                      {TEAM_PLACEHOLDER_LABEL}
                    </span>
                  )}
                  <span aria-hidden="true" className="font-display text-xs text-accent tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          </li>
        ))}
      </ul>

      <Reveal delay={80}>
        <div className="mt-16 flex flex-col items-start gap-5 border-t border-ink/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-2xl font-medium text-ink">{teamOutro.line}</p>
          <Button href={teamOutro.cta.href} withArrow>
            {teamOutro.cta.label}
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
