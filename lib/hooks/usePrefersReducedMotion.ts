"use client";

import { useEffect, useState } from "react";

/**
 * Liest `prefers-reduced-motion` erst nach dem Mount (SSR-sicher).
 * Default `false`, damit Server- und Client-HTML übereinstimmen.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}
