import { HeroStatic } from "@/components/hero/HeroStatic";
import { TeamStatic } from "@/components/team/TeamStatic";

/**
 * Die Fahrt ohne Fahrt: bei prefers-reduced-motion und ohne JavaScript.
 *
 * Statt der Kamerafahrt stehen dieselben Inhalte ruhig untereinander –
 * die Eröffnung mit Arzt und Wegen, danach das Praxisteam als
 * Editorial-Layout. Nichts hängt an Bewegung; die ausführlichen Sektionen
 * folgen wie gewohnt darunter.
 */
export function CinemaStatic() {
  return (
    <>
      <HeroStatic />
      <div className="bg-cream">
        <TeamStatic />
      </div>
    </>
  );
}
