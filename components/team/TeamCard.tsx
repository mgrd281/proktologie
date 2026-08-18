import { cn } from "@/lib/cn";
import {
  TEAM_IMAGE_HEIGHT,
  TEAM_IMAGE_WIDTH,
  TEAM_PLACEHOLDER_LABEL,
  type TeamMember,
} from "@/content/team";
import { forwardRef } from "react";

/**
 * Eine Porträt-Ebene der Szene – bewusst keine „Karte": kein weißer Kasten,
 * kein Produkt-Schatten. Das Foto selbst ist die Fläche; eine haarfeine
 * Lichtkante und ein zurückhaltender Glow in Klinikgrün setzen sie in den
 * Raum, so wie eine beleuchtete Glastafel am Empfangstresen.
 *
 * Die Nummer steht oben links in der Ebene, die neutrale Bezeichnung unten
 * über einer grünen Haarlinie. Personenangaben erscheinen nur, wenn sie in
 * content/team.ts bestätigt hinterlegt sind – es wird nichts erfunden.
 */

interface TeamCardProps {
  member: TeamMember;
  index: number;
  /** Erste Ebene lädt sofort – sie steht schon im Intro im Bild. */
  eager?: boolean;
  className?: string;
}

export const TeamCard = forwardRef<HTMLLIElement, TeamCardProps>(
  function TeamCard({ member, index, eager = false, className }, ref) {
    const number = String(index + 1).padStart(2, "0");

    return (
      <li
        ref={ref}
        data-card={index}
        className={cn(
          "team-plane absolute top-1/2 left-1/2 w-[var(--plane-w)]",
          className,
        )}
      >
        <div className="team-plane-frame relative overflow-hidden rounded-[22px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- statischer Export ohne Bildoptimierungs-Server */}
          <img
            src={`${member.image}-840.webp`}
            srcSet={`${member.image}-420.webp 420w, ${member.image}-840.webp 840w`}
            sizes="(min-width: 1024px) 420px, 285px"
            alt={member.alt}
            width={TEAM_IMAGE_WIDTH}
            height={TEAM_IMAGE_HEIGHT}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            draggable={false}
            className="block aspect-[4/5] w-full object-cover object-top"
          />

          {/* Nummer oben links, wie in der Vorlage */}
          <p
            aria-hidden="true"
            className="font-display absolute top-4 left-4 text-lg leading-none font-medium text-cream/90 tabular-nums drop-shadow-[0_1px_6px_rgba(23,37,27,0.7)]"
          >
            {number}
          </p>

          {/* Fußzeile: grüne Haarlinie + neutrale Bezeichnung */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5">
            <span
              aria-hidden="true"
              className="block h-px w-full bg-gradient-to-r from-accent/80 via-accent/35 to-transparent"
            />
            {member.name ? (
              <p className="font-display mt-2.5 truncate text-sm font-medium text-cream drop-shadow-[0_1px_6px_rgba(23,37,27,0.8)]">
                {member.name}
                {member.role && (
                  <span className="block truncate text-xs font-normal text-cream/80">
                    {member.role}
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-2.5 text-[10px] font-semibold tracking-[0.22em] text-cream/85 uppercase drop-shadow-[0_1px_6px_rgba(23,37,27,0.85)]">
                {TEAM_PLACEHOLDER_LABEL}
              </p>
            )}
          </div>

          {/* Feine Lichtkante */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/25"
          />
          {/* Tiefenschleier statt Weichzeichner (siehe globals.css) */}
          <span
            aria-hidden="true"
            className="team-veil pointer-events-none absolute inset-0 rounded-[22px] bg-cream"
          />
        </div>
      </li>
    );
  },
);
