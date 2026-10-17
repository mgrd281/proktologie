"use client";

import { useEffect, useState } from "react";

/**
 * Welcher Abschnitt der Startseite gerade gelesen wird – für die Markierung
 * in der Navigation (`aria-current`). Maßgeblich ist der Abschnitt, der ein
 * schmales Band bei gut einem Drittel der Bildschirmhöhe kreuzt; in der
 * Kamerafahrt und zwischen den Abschnitten ist keiner markiert. Auf
 * Unterseiten gibt es die Abschnitte nicht – dann bleibt es bei null.
 *
 * `ids` muss stabil sein (Konstante auf Modulebene).
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setActive(ids.find((id) => inBand.has(id)) ?? null);
      },
      { rootMargin: "-35% 0px -64% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
