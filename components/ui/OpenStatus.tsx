"use client";

import { useEffect, useState } from "react";
import { unbreakableTimes } from "@/content/chat";
import { site } from "@/content/site";
import { openLine, openState } from "@/lib/booking/opening";
import { sharedCockpitStatus, type HoursInfo } from "@/lib/booking/status";
import { cn } from "@/lib/cn";

/**
 * „Jetzt geöffnet · bis 12:00 Uhr“ / „Heute geschlossen · wieder Di ab
 * 07:00 Uhr“ – aus der Sprechzeit, die das Cockpit für heute meldet (mit
 * Urlaub und Feiertagen). Ohne Cockpit oder ohne gültige Meldung steht hier
 * nichts; die Sprechzeiten-Liste markiert dann nur den heutigen Tag.
 * Die Zeile rechnet jede Minute neu, damit „bis 12:00 Uhr“ nicht stehen bleibt.
 */
export function OpenStatus({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const [hours, setHours] = useState<HoursInfo | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (site.bookingProvider !== "cockpit" || !site.cockpitApiUrl) return;
    let alive = true;
    void sharedCockpitStatus(site.cockpitApiUrl).then((status) => {
      if (!alive || !status?.hours) return;
      setHours(status.hours);
      setNow(new Date());
    });
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!hours || !now) return null;
  const state = openState(hours, now);
  if (!state) return null;
  const open = state.kind === "open";
  return (
    <p className={cn("flex items-center gap-2 text-sm", onDark ? "text-cream/80" : "text-ink/75", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", open ? (onDark ? "bg-accent" : "bg-primary") : onDark ? "bg-cream/40" : "bg-ink/35")}
      />
      {unbreakableTimes(openLine(state, now))}
    </p>
  );
}
