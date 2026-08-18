import { cn } from "@/lib/cn";
import {
  TEAM_IMAGE_HEIGHT,
  TEAM_IMAGE_WIDTH,
  TEAM_PLACEHOLDER_LABEL,
  type TeamMember,
} from "@/content/team";
import { forwardRef } from "react";

/**
 * Eine Porträt-Ebene der Szene – bewusst keine „Karte": kein weißer
 * Kasten, kein Rahmen ums Bild, kein Produkt-Schatten. Das Foto selbst
 * ist die Fläche; eine haarfeine Kante und ein weicher Umgebungsschatten
 * setzen sie in den Raum.
 *
 * Das Info-Band unten bleibt leer, solange keine bestätigten Angaben
 * vorliegen (content/team.ts) – es erscheint automatisch, sobald `name`
 * gefüllt ist. Es wird nichts erfunden.
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
    return (
      <li
        ref={ref}
        data-card={index}
        className={cn(
          "team-plane absolute top-1/2 left-1/2 w-[var(--plane-w)]",
          className,
        )}
      >
        <div className="relative overflow-hidden rounded-[24px] bg-mist shadow-[0_24px_48px_-24px_rgba(0,0,0,0.6)] ring-1 ring-white/25">
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

          {/* Sehr feine Lichtkante – setzt die Ebene in den Raum */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/10"
          />
          {/* Tiefenschleier statt Weichzeichner (siehe globals.css) */}
          <span
            aria-hidden="true"
            className="team-veil pointer-events-none absolute inset-0 rounded-[24px] bg-deep"
          />

          {/* Info-Band: Nummer immer, Personenangaben nur wenn bestätigt */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-deep/75 via-deep/35 to-transparent px-5 pt-10 pb-4">
            <div className="min-w-0">
              {member.name ? (
                <>
                  <p className="font-display truncate text-base font-medium text-cream">
                    {member.name}
                  </p>
                  {member.role && (
                    <p className="truncate text-xs text-cream/75">{member.role}</p>
                  )}
                </>
              ) : (
                <p className="text-[11px] font-semibold tracking-[0.2em] text-cream/80 uppercase">
                  {TEAM_PLACEHOLDER_LABEL}
                </p>
              )}
            </div>
            <p
              aria-hidden="true"
              className="font-display text-sm text-accent tabular-nums"
            >
              {String(index + 1).padStart(2, "0")}
            </p>
          </div>
        </div>
      </li>
    );
  },
);
