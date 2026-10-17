"use client";

import { Icon } from "@/components/ui/Icon";
import { bookingCopy } from "@/content/booking";
import { site } from "@/content/site";
import { buildIcs } from "@/lib/booking/ics";
import type { Booked, SendState } from "@/lib/booking/useBookingFlow";
import type { Ref } from "react";

/**
 * Abschluss – erst nach der Antwort des Systems, nie davor. Im verbindlichen
 * Modus nennt er Tag, Uhrzeit und Adresse aus der Antwort des Cockpits (nicht
 * aus der Eingabe), die Referenz, „In den Kalender“ (Datei aus dem Browser)
 * und „Anfahrt“. Im Wunschtermin-Modus sagt er ehrlich, was noch fehlt.
 */

// Zeit aus der Antwort des Cockpits (UTC), angezeigt in Berlin
const bookedDateFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const bookedTimeFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
});

const quietButton =
  "inline-flex min-h-11 items-center gap-2.5 rounded-full border border-ink/25 px-4 text-sm font-medium text-ink transition-colors duration-300 hover:border-primary hover:text-primary active:bg-mist";

/** „In den Kalender“: Datei im Browser erzeugen und herunterladen – nichts geht an einen Dienst. */
function downloadCalendar(booked: Booked) {
  const ics = buildIcs({
    // Gleiche Kennung wie die Einladung aus der Mail; ältere Cockpits melden keine
    uid: booked.calendarUid ?? `${booked.ref}@proktologie-eimsbuettel.de`,
    start: new Date(booked.startsAt),
    end: new Date(booked.endsAt),
    title: bookingCopy.confirm.calendarTitle,
    location: `${site.name}, ${site.address.street}, ${site.address.zip} ${site.address.city}`,
    description: `${bookingCopy.confirm.refLabel}: ${booked.ref}\nTelefon: ${site.phone}`,
  });
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "termin-proktologie-eimsbuettel.ics";
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

interface BookingSuccessProps {
  send: Extract<SendState, { kind: "done" }>;
  headingRef: Ref<HTMLHeadingElement>;
  calendarSaved: boolean;
  onCalendarSaved: () => void;
  /** „Anfahrt“: Dialog schließen und zur Praxis-Sektion */
  onDirections: () => void;
  /** „Weiteren Termin buchen“ */
  onAgain: () => void;
}

export function BookingSuccess({
  send,
  headingRef,
  calendarSaved,
  onCalendarSaved,
  onDirections,
  onAgain,
}: BookingSuccessProps) {
  const confirmed = send.method === "confirmed";
  return (
    <div>
      <span
        aria-hidden="true"
        className="booking-success-mark flex size-12 items-center justify-center rounded-full bg-accent text-deep"
      >
        <Icon name="check" size={22} />
      </span>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="font-display mt-4 text-2xl font-medium text-ink outline-none!"
      >
        {confirmed
          ? bookingCopy.confirm.successHeadingConfirmed
          : send.method === "mailto"
            ? bookingCopy.confirm.successHeadingMailto
            : bookingCopy.confirm.successHeading}
      </h3>

      {send.method === "confirmed" && (
        <ul className="mt-5 space-y-2.5 rounded-xl bg-mist/60 px-4 py-4 text-sm leading-relaxed text-ink">
          <li className="flex items-start gap-3">
            <Icon name="calendar" size={18} className="mt-0.5 shrink-0 text-primary-deep" />
            <span className="font-medium">{bookedDateFormat.format(new Date(send.booked.startsAt))}</span>
          </li>
          <li className="flex items-start gap-3">
            <Icon name="clock" size={18} className="mt-0.5 shrink-0 text-primary-deep" />
            <span className="font-medium">{bookedTimeFormat.format(new Date(send.booked.startsAt))} Uhr</span>
          </li>
          <li className="flex items-start gap-3">
            <Icon name="pin" size={18} className="mt-0.5 shrink-0 text-primary-deep" />
            <span>
              {site.name}
              <br />
              {site.address.street}, {site.address.zip} {site.address.city}
            </span>
          </li>
        </ul>
      )}

      <p role="status" className="mt-4 text-sm leading-relaxed text-ink/70">
        {confirmed
          ? bookingCopy.confirm.successConfirmed
          : send.method === "mailto"
            ? bookingCopy.confirm.successMailto
            : bookingCopy.confirm.successEndpoint}
      </p>

      {send.method === "confirmed" && (
        <>
          <p className="mt-4 inline-flex items-baseline gap-2 rounded-xl border border-ink/10 bg-mist/40 px-4 py-2.5 text-sm">
            <span className="text-xs font-medium tracking-wide text-ink/70 uppercase">
              {bookingCopy.confirm.refLabel}
            </span>
            <span className="font-display text-lg font-medium tabular-nums text-ink">{send.booked.ref}</span>
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                downloadCalendar(send.booked);
                onCalendarSaved();
              }}
              className={quietButton}
            >
              <Icon name="calendar" size={16} />
              {bookingCopy.confirm.addToCalendar}
            </button>
            <button type="button" onClick={onDirections} className={quietButton}>
              <Icon name="pin" size={16} />
              {bookingCopy.confirm.directions}
            </button>
          </div>
          <p role="status" className="mt-2 text-xs leading-relaxed text-ink/70">
            {calendarSaved ? bookingCopy.confirm.calendarSaved : ""}
          </p>
        </>
      )}

      <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
        <button
          type="button"
          onClick={onAgain}
          className="min-h-11 text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {confirmed ? bookingCopy.confirm.newBooking : bookingCopy.confirm.newRequest}
        </button>
        {!confirmed && site.doctolibConfigured && (
          <a
            href={site.doctolibUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
          >
            {bookingCopy.confirm.doctolibCta}
            <Icon name="arrow-right" size={15} />
          </a>
        )}
      </div>
    </div>
  );
}
