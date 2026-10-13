import { DoctorPortrait } from "@/components/ui/DoctorPortrait";
import { arzt } from "@/content/arzt";
import { cn } from "@/lib/cn";

/**
 * Medien-Slot der ruhigen Eröffnung: das Porträt des Arztes.
 *
 * Hier stand früher ein <video> mit hero-mobile.webm/.mp4 – die Dateien
 * gab es nie, jeder Besuch erzeugte zwei 404 und fiel danach ohnehin auf
 * dieses Porträt zurück. Jetzt steht es direkt da, ohne Umweg.
 */
export function HeroMobileMedia({ className }: { className?: string }) {
  return (
    <DoctorPortrait
      alt={arzt.portraitAlt}
      priority
      className={cn("rounded-2xl", className)}
    />
  );
}
