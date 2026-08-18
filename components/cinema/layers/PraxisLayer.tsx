import { Icon } from "@/components/ui/Icon";
import { praxisSection } from "@/content/sections";
import { site } from "@/content/site";
import Link from "next/link";
import { forwardRef } from "react";

/**
 * Zustand 07 – die Praxis. Letzte Ebene der Fahrt: Während die Porträts in
 * die Tiefe zurückweichen, tritt der Empfang nach vorn und mit ihm das
 * Konkrete – Adresse, Sprechzeiten, Anfahrt. Von hier läuft die Bühne aus
 * und übergibt an die normale Seite.
 *
 * Sichtbarkeit und Bewegung schreibt ausschließlich die MasterSequence.
 */
export const PraxisLayer = forwardRef<HTMLDivElement>(function PraxisLayer(_, ref) {
  return (
    <div
      ref={ref}
      className="cinema-praxis pointer-events-none absolute inset-y-0 right-0 flex w-full items-center justify-end px-5 md:px-10 lg:w-[52%] lg:px-16 lg:pr-28"
      style={{ opacity: 0, visibility: "hidden" }}
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-cream/92 p-6 shadow-[0_30px_70px_-40px_rgba(23,37,27,0.6)] ring-1 ring-ink/8 backdrop-blur-sm md:p-7">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary-deep uppercase">
          {praxisSection.kicker}
        </p>

        <p className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-ink">
          <Icon name="pin" size={17} className="mt-0.5 shrink-0 text-primary" />
          <span>
            {site.address.street}
            <br />
            {site.address.zip} {site.address.city}
            <br />
            <span className="text-ink/60">{site.transitNote}</span>
          </span>
        </p>

        <dl className="mt-5 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
          {site.hours.map((entry) => (
            <div key={entry.days} className="flex items-baseline justify-between gap-4">
              <dt className="text-ink/60">{entry.days}</dt>
              <dd className="text-right font-medium text-ink tabular-nums">{entry.time}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/#kontakt"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-deep transition-colors duration-300 hover:bg-[#76a81f]"
          >
            Termin vereinbaren
            <Icon name="arrow-right" size={15} />
          </Link>
          <Link
            href="/#praxis"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {praxisSection.mapsLabel}
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
});
