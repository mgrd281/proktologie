import { Icon } from "@/components/ui/Icon";
import { CINEMA_TERMIN } from "@/content/cinema";
import Link from "next/link";
import { forwardRef } from "react";

/**
 * Zustand 09 – die Buchungs-Vorschau.
 *
 * Die Fahrt endet nicht abrupt vor der Terminvereinbarung: Während sich
 * die Umgebung in Cream auflöst, steht hier bereits die Vorschau der
 * Buchung – dieselben fünf Schritte, dieselbe Kartensprache wie die echte
 * BookingCard, in die der Auslauf direkt übergibt (die Kontakt-Sektion
 * ist die ERSTE Sektion nach der Fahrt).
 *
 * Wichtig: Das ist eine VORSCHAU, kein zweites Formular. Keine
 * Formularelemente, keine ids, aria-hidden – die echte, zugängliche
 * BookingCard existiert genau einmal in #kontakt. Nur der CTA-Link ist
 * echt und liegt außerhalb des aria-hidden-Teils.
 *
 * Sichtbarkeit/Bewegung schreibt ausschließlich die MasterSequence. Im
 * DOM liegt die Ebene ÜBER dem Auslauf-Schleier: Sie verblasst nie,
 * sondern reitet auf der Cream-Fläche in die echte Karte hinein.
 */
export const TerminLayer = forwardRef<HTMLDivElement>(function TerminLayer(_, ref) {
  return (
    <div
      ref={ref}
      className="cinema-termin pointer-events-none absolute inset-y-0 right-0 flex w-full items-center justify-center px-5 md:justify-end md:px-10 lg:w-[54%] lg:px-16 lg:pr-28"
      style={{ opacity: 0, visibility: "hidden" }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-cream p-6 shadow-[0_30px_70px_-40px_rgba(23,37,27,0.55)] ring-1 ring-ink/8 md:p-7">
        <div aria-hidden="true">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary-deep uppercase">
            {CINEMA_TERMIN.kicker}
          </p>
          <p className="font-display mt-3 text-2xl leading-snug font-medium text-ink">
            {CINEMA_TERMIN.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">{CINEMA_TERMIN.text}</p>

          <ol className="mt-5 space-y-2.5 border-t border-ink/10 pt-4">
            {CINEMA_TERMIN.steps.map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-sm text-ink/80">
                <span className="font-display flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary-deep tabular-nums">
                  {step.number}
                </span>
                {step.label}
              </li>
            ))}
          </ol>
        </div>

        <Link
          href={CINEMA_TERMIN.cta.href}
          className="pointer-events-auto mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-accent px-7 text-sm font-semibold text-deep transition-colors duration-300 hover:bg-[#76a81f]"
        >
          {CINEMA_TERMIN.cta.label}
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
});
