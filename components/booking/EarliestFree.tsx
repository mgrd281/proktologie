"use client";

import { appointmentTypes, bookingCopy } from "@/content/booking";
import { site } from "@/content/site";
import { sharedBookingProvider } from "@/lib/booking/provider";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";

/**
 * „Freie Termine ab Mo., 19. Oktober“ unter dem ersten Termin-Knopf der
 * Eröffnung (dunkler Grund). Nur mit echter Verfügbarkeit – im
 * Wunschtermin-Modus gibt es nichts zu versprechen – und erst, wenn die
 * Seite steht: Der Abruf wartet, bis der Browser Luft hat. Die Zeile liegt
 * absolut unter dem Knopf und verschiebt nichts; ohne Antwort bleibt sie
 * weg. Grundlage ist die erste Terminart („Beschwerden / unklar“), der
 * Kalender nennt je Terminart den genauen Tag. Derselbe Provider wie in der
 * Buchungskarte: Was hier geladen ist, zeigt der Kalender ohne zweiten Abruf.
 */

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "long",
});

export function EarliestFree({ className }: { className?: string }) {
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    if (site.bookingProvider !== "cockpit") return;
    let cancelled = false;
    const load = () => {
      sharedBookingProvider()
        .then((provider) =>
          provider.mode === "confirmed" && provider.getEarliestDate
            ? provider.getEarliestDate(appointmentTypes[0].id)
            : null,
        )
        .then((found) => {
          if (!cancelled) setDate(found);
        })
        .catch(() => {
          // Keine Zeile ist besser als eine falsche
        });
    };
    const idle = typeof window.requestIdleCallback === "function";
    const handle = idle ? window.requestIdleCallback(load, { timeout: 2500 }) : window.setTimeout(load, 1200);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  return (
    <p className={cn("animate-step-in flex items-center gap-2.5 text-sm text-cream/85", className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
      {bookingCopy.freeFrom} {dateFormat.format(new Date(y, m - 1, d))}
    </p>
  );
}
