"use client";

import { useEffect, type RefObject } from "react";

/**
 * Liefert den Scroll-Fortschritt (0–1) eines hohen Track-Elements mit
 * innenliegender sticky Stage: 0 = Track-Oberkante erreicht den Viewport-
 * Anfang, 1 = Track-Unterkante verlässt den Viewport.
 *
 * Performance: rAF-gedrosselt, der Wert wird per Callback geliefert und
 * bewusst NICHT in React-State geschrieben – der Aufrufer mutiert Styles
 * direkt über Refs.
 */
export function useScrollProgress(
  trackRef: RefObject<HTMLElement | null>,
  onProgress: (progress: number) => void,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const track = trackRef.current;
    if (!track) return;

    let rafId = 0;
    let scheduled = false;

    const measure = () => {
      scheduled = false;
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      // display:none oder zu kleiner Track: nichts zu tun
      if (total <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      onProgress(progress);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      rafId = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(rafId);
    };
  }, [trackRef, onProgress, enabled]);
}
