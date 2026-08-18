import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TeamPhoto } from "@/components/ui/TeamPhoto";
import {
  team,
  teamIntro,
  TEAM_IMAGE_HEIGHT,
  TEAM_IMAGE_WIDTH,
  TEAM_PLACEHOLDER_LABEL,
} from "@/content/team";

/**
 * „Unser Praxisteam" – sechs echte Mitarbeiter-Porträts im 4:5-Raster
 * (Desktop 3 Spalten, Tablet 2, Mobil 1).
 *
 * Namen, Rollen und weitere Personenangaben sind nicht bestätigt und
 * werden deshalb NICHT dargestellt (siehe content/team.ts). Bis dahin
 * trägt jede Karte das neutrale Label „Praxisteam"; sobald echte Daten
 * in der Datendatei stehen, erscheinen sie hier automatisch.
 */
export function Team() {
  return (
    <section id="team" aria-labelledby="team-title" className="bg-cream">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <SectionHeading
            id="team-title"
            kicker={teamIntro.kicker}
            title={teamIntro.title}
          />
          <p className="mt-6 max-w-2xl leading-relaxed text-ink/70">
            {teamIntro.text}
          </p>
        </Reveal>

        <Reveal delay={60}>
          <TeamPhoto className="mt-14" />
        </Reveal>

        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((member, index) => (
            <li key={member.id}>
              <Reveal delay={(index % 3) * 80}>
                <article className="group overflow-hidden rounded-2xl bg-white ring-1 ring-ink/5 transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:ring-ink/10">
                  <div className="aspect-[4/5] overflow-hidden bg-mist">
                    {/* eslint-disable-next-line @next/next/no-img-element -- statischer Export ohne Bildoptimierungs-Server */}
                    <img
                      src={`${member.image}-840.webp`}
                      srcSet={`${member.image}-420.webp 420w, ${member.image}-840.webp 840w`}
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                      alt={member.alt}
                      width={TEAM_IMAGE_WIDTH}
                      height={TEAM_IMAGE_HEIGHT}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="px-6 py-5">
                    {member.name ? (
                      <>
                        <h3 className="font-display text-lg font-medium text-ink">
                          {member.name}
                        </h3>
                        {member.role && (
                          <p className="mt-1 text-sm text-ink/70">{member.role}</p>
                        )}
                        {member.languages.length > 0 && (
                          <p className="mt-2 text-xs text-ink/60">
                            {member.languages.join(" · ")}
                          </p>
                        )}
                      </>
                    ) : (
                      /* Neutrales Label – es werden keine Angaben erfunden */
                      <p className="text-xs font-semibold tracking-[0.2em] text-primary-deep uppercase">
                        {TEAM_PLACEHOLDER_LABEL}
                      </p>
                    )}
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
