"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type RefObject } from "react";

/**
 * Liegt hinter dem Element gerade eine dunkle Fläche? Für die durchscheinende
 * Handy-Leiste: Über Dunklem wird sie rauchig mit heller Schrift, über Hellem
 * milchig mit dunkler – so bleibt sie überall lesbar.
 *
 * Gemessen wird auf Höhe der Elementmitte. Dunkel sind:
 * - die Kamerafahrt bis zu dem Fortschritt, ab dem sie hell wird
 *   (`data-header-solid` – derselbe Wert, nach dem der Header umschaltet;
 *   er gilt für die ganze Bühne, oben wie unten);
 * - der dunkle Eröffnungsblock der ruhigen Fassung (`data-header-dark`);
 * - Abschnitte mit `data-surface="dark"` (etwa „Warum wir“ und die Fußzeile).
 *
 * Startwert: Die Startseite beginnt dunkel (Auftakt), alle anderen hell.
 */
export function useDarkBehind(ref: RefObject<HTMLElement | null>): boolean {
  const pathname = usePathname();
  const [dark, setDark] = useState(pathname === "/");

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      // Ab md ist die Leiste ausgeblendet – dann gibt es nichts zu messen
      if (box.height === 0) return;
      const line = box.top + box.height / 2;
      const track = document.querySelector<HTMLElement>("[data-header-solid]");
      if (track && track.offsetHeight > 0) {
        const t = track.getBoundingClientRect();
        if (t.top <= line && t.bottom >= line) {
          const at = Number(track.dataset.headerSolid);
          const progress = -t.top / Math.max(1, track.offsetHeight - window.innerHeight);
          setDark(!(Number.isFinite(at) && progress > at));
          return;
        }
      }
      for (const surface of document.querySelectorAll<HTMLElement>('[data-header-dark], [data-surface="dark"]')) {
        const s = surface.getBoundingClientRect();
        if (s.height > 0 && s.top <= line && s.bottom >= line) {
          setDark(true);
          return;
        }
      }
      setDark(false);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
    // Nach einem Seitenwechsel neu messen (die Leiste bleibt über Navigationen gemountet)
  }, [ref, pathname]);

  return dark;
}
