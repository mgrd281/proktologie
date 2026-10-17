"use client";

import { useEffect, useState } from "react";

/**
 * Die Uhr der Oberfläche: beginnt mit der Zeit des Servers (gleiches HTML
 * beim Hydrieren) und tickt dann alle `ms` – für die Jetzt-Linie, „läuft“
 * und „überfällig“, ohne dass jemand die Seite neu laden muss.
 */
export function useNow(serverNow: string, ms = 30_000): number {
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
