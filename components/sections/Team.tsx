import { TeamScene } from "@/components/team/TeamScene";
import { TeamStatic } from "@/components/team/TeamStatic";

/**
 * „Unser Praxisteam" – als räumliche Szene statt als Kartenraster.
 *
 * Weiche rein per CSS (wie beim Hero): mit erlaubter Bewegung läuft die
 * scroll-getriebene Szene, bei prefers-reduced-motion oder ohne
 * JavaScript die ruhige Editorial-Variante. Beide zeigen dieselben sechs
 * echten Porträts mit denselben neutralen Angaben – es wird nichts
 * erfunden (siehe content/team.ts).
 */
export function Team() {
  return (
    <section id="team" aria-label="Unser Praxisteam" className="bg-cream">
      <noscript>
        <style>{`.team-motion{display:none !important}.team-still{display:block !important}`}</style>
      </noscript>

      <div className="team-motion hidden motion-safe:block">
        <TeamScene />
      </div>

      <div className="team-still motion-safe:hidden">
        <TeamStatic />
      </div>
    </section>
  );
}
