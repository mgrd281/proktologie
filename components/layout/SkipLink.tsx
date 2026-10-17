"use client";

import { ctaHref } from "@/content/navigation";
import { usePathname } from "next/navigation";

const skipClass =
  "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-full focus:bg-primary focus:px-6 focus:py-3 focus:text-sm focus:font-medium focus:text-white";

/**
 * Die ersten fokussierbaren Elemente der Seite: „Zum Inhalt springen“ und
 * – weil die Startseite mit einer langen Kamerafahrt beginnt – dort direkt
 * „Zur Terminbuchung“ (nur dort: Ein Sprunglink zielt auf diese Seite).
 * Beide erscheinen erst, wenn sie den Fokus haben.
 */
export function SkipLink() {
  const home = usePathname() === "/";
  return (
    <>
      <a href="#main" className={skipClass}>
        Zum Inhalt springen
      </a>
      {home && (
        <a href={ctaHref} className={skipClass}>
          Zur Terminbuchung
        </a>
      )}
    </>
  );
}
