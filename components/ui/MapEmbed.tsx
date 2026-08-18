"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { ctaLabel } from "@/content/navigation";
import { praxisSection } from "@/content/sections";
import { site } from "@/content/site";

/**
 * Echte Google-Maps-Karte als Zwei-Klick-Lösung.
 *
 * Rechtlicher Hintergrund: Ein direkt eingebettetes Maps-iframe überträgt
 * beim Seitenaufruf IP-Adresse und Browserdaten an Google – in Deutschland
 * ohne vorherige Einwilligung ein Abmahnrisiko. Deshalb wird zunächst nur
 * eine gestaltete Vorschau gezeigt; das iframe lädt erst nach dem
 * ausdrücklichen Klick auf „Karte laden" (Einwilligung, Art. 6 Abs. 1
 * lit. a DSGVO). Vorher geht kein einziger Request an Google.
 *
 * Der Embed nutzt die schlüsselfreie Maps-URL – kein API-Key, keine
 * Abrechnung, keine Wartung.
 */

const mapQuery = encodeURIComponent(
  `${site.address.street}, ${site.address.zip} ${site.address.city}`,
);
const MAP_EMBED_SRC = `https://www.google.com/maps?q=${mapQuery}&hl=de&z=16&output=embed`;

export function MapEmbed({ className }: { className?: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={cn(
        "on-dark overflow-hidden rounded-2xl bg-deep",
        className,
      )}
    >
      <div className="relative min-h-80 md:min-h-[26rem]">
        {loaded ? (
          <iframe
            src={MAP_EMBED_SRC}
            title={praxisSection.mapIframeTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <>
            {/* Gestaltete Vorschau – rein lokal, ohne externe Requests */}
            <svg
              viewBox="0 0 600 400"
              className="absolute inset-0 h-full w-full opacity-40"
              aria-hidden="true"
              focusable="false"
              preserveAspectRatio="xMidYMid slice"
            >
              <g stroke="#527A32" strokeWidth="1.2" fill="none">
                <path d="M0 90 C 150 70, 320 120, 600 80" />
                <path d="M0 190 C 180 160, 380 220, 600 180" />
                <path d="M0 300 C 200 270, 400 330, 600 290" />
                <path d="M110 0 C 130 140, 90 280, 120 400" />
                <path d="M300 0 C 320 130, 280 260, 310 400" />
                <path d="M480 0 C 500 150, 460 280, 490 400" />
              </g>
              <g stroke="#86BC23" strokeOpacity="0.4" strokeWidth="1">
                <path d="M0 145 C 170 120, 360 170, 600 130" fill="none" />
                <path d="M200 0 C 220 140, 180 270, 210 400" fill="none" />
              </g>
            </svg>
            <span
              aria-hidden="true"
              className="absolute top-[34%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-accent text-deep shadow-lg">
                <Icon name="pin" size={20} />
              </span>
              <span className="size-2 rounded-full bg-accent/40" />
            </span>

            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-6 md:p-7">
              <p className="max-w-md text-xs leading-relaxed text-cream/70">
                {praxisSection.mapPrivacyNote}
              </p>
              <button
                type="button"
                onClick={() => setLoaded(true)}
                className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-deep transition-colors hover:bg-[#76a81f]"
              >
                <Icon name="pin" size={16} />
                {praxisSection.mapLoadLabel}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Info-Leiste: funktioniert unabhängig davon, ob die Karte geladen ist */}
      <div className="flex flex-col gap-4 border-t border-white/10 p-6 md:flex-row md:items-center md:justify-between md:p-7">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            {site.district}, {site.city}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-cream/75">
            {site.address.street}, {site.address.zip} {site.address.city} ·{" "}
            {site.transitNote}
          </p>
          <a
            href={site.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            {praxisSection.mapsLabel}
            <Icon name="arrow-right" size={16} />
          </a>
        </div>
        <Button href="/#kontakt" withArrow className="shrink-0">
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
