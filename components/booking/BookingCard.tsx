"use client";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { LoadError } from "@/components/booking/LoadError";
import { StepCalendar } from "@/components/booking/StepCalendar";
import { StepConfirm } from "@/components/booking/StepConfirm";
import { StepDetails } from "@/components/booking/StepDetails";
import { StepFrame } from "@/components/booking/StepFrame";
import { StepSlots } from "@/components/booking/StepSlots";
import { StepTypes } from "@/components/booking/StepTypes";
import { appointmentTypes, bookingCopy, bookingSteps } from "@/content/booking";
import { buildIcs } from "@/lib/booking/ics";
import type { BookingProvider } from "@/lib/booking/provider";
import { sharedBookingProvider } from "@/lib/booking/provider";
import type { BookingDraft, BookingSlot } from "@/lib/booking/types";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { useLenis } from "@/providers/LenisProvider";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Orchestrator der Terminbuchung: Schritt-State, Draft-State (Eingaben
 * bleiben beim Vor/Zurück erhalten), Fokus-Management und Abschluss.
 * Sämtliche Verfügbarkeit kommt über das BookingProvider-Interface –
 * hier ist nichts hartkodiert. Alle Daten bleiben clientseitig
 * (kein localStorage, keine URLs mit Personenbezug, kein Logging).
 *
 * Im verbindlichen Modus (Provider „cockpit“) endet der Flow mit einer
 * echten Buchung samt Referenz; die Bestätigung kommt per E-Mail. Der
 * Abschluss nennt Tag, Uhrzeit und Adresse und bietet „In den Kalender“
 * (Datei aus dem Browser) und „Anfahrt“.
 *
 * Zurück-Geste (Handy) und Zurück-Knopf des Browsers gehen einen Schritt
 * zurück statt von der Seite: Solange die Buchung unterwegs ist, liegt genau
 * EIN eigener Verlaufseintrag obenauf (ohne Adressänderung – Next.js lädt
 * dabei nichts neu). Wird er verlassen, geht die Karte einen Schritt zurück
 * und legt ihn neu an, solange noch ein Schritt davor liegt.
 */

const emptyDraft: BookingDraft = {
  typeId: null,
  date: null,
  slotId: null,
  time: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  consent: false,
  website: "",
};

const slotDateFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
// Abschluss: Zeit aus der Antwort des Cockpits (UTC), angezeigt in Berlin
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

interface Booked {
  ref: string;
  startsAt: string;
  endsAt: string;
  calendarUid?: string;
}

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; method: "mailto" | "endpoint" }
  | { kind: "done"; method: "confirmed"; booked: Booked }
  | { kind: "error"; text: string; code?: string };

/** Verlaufseintrag der Buchung – Next.js ergänzt seine eigenen Felder. */
const isBookingEntry = (state: unknown) => Boolean((state as { booking?: unknown } | null)?.booking);

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

export function BookingCard() {
  const [provider, setProvider] = useState<BookingProvider | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  /** Die Zeiten des gewählten Tages ließen sich nicht laden. */
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  /** „In den Kalender“ geklickt – Hinweis, dass die Datei geladen ist */
  const [calendarSaved, setCalendarSaved] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  // Beim Schrittwechsel gleitet der alte Schritt noch kurz hinaus; verschwindet
  // er, würde ein gewöhnlicher Ref auf null fallen – obwohl der neue längst steht.
  const setHeading = useCallback((el: HTMLHeadingElement | null) => {
    if (el) headingRef.current = el;
  }, []);
  const setSuccess = useCallback((el: HTMLParagraphElement | null) => {
    if (el) successRef.current = el;
  }, []);
  const mounted = useRef(false);
  const { scrollTo } = useLenis();
  // Latest-wins-Token: schützt vor veralteten Slot-Antworten, falls ein
  // Provider asynchron/netzwerkbasiert antwortet (Cockpit).
  const slotsRequest = useRef(0);

  useEffect(() => {
    void sharedBookingProvider().then(setProvider);
  }, []);

  // Fokus-Management: Schrittwechsel → Schritt-Überschrift; Abschluss →
  // Erfolgs-Überschrift. Während „sending"/„error" wird NICHT umfokussiert.
  // Handy: Die Karte rückt jedes Mal an den Anfang, direkt unter den Header –
  // sonst landet der neue Schritt halb verdeckt oder der Knopf unter der
  // Aktionsleiste. Am Desktop bleibt es beim schlichten Fokus.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const target =
      send.kind === "done" ? successRef.current : send.kind === "idle" ? headingRef.current : null;
    if (!target) return;
    const mobile = window.matchMedia("(max-width: 47.99rem)").matches;
    target.focus({ preventScroll: mobile });
    const card = cardRef.current;
    if (!mobile || !card) return;
    // Ein Bild warten: Wird der neue Schritt kürzer, verschiebt der Browser
    // die Seite (Scroll Anchoring) – Lenis kennt die neue Position erst nach
    // dem nächsten scroll-Ereignis und würde sonst zu kurz fahren.
    // 16 px Luft unter dem Header (der Header-Abstand selbst kommt aus scroll-padding)
    const frame = requestAnimationFrame(() => scrollTo(card, -16));
    return () => cancelAnimationFrame(frame);
  }, [step, send.kind, scrollTo]);

  // Scheitert das Absenden, steht die Meldung unter dem Knopf – auf dem Handy
  // oft hinter der Aktionsleiste. Dann rückt sie ins Bild (Fokus bleibt am Knopf).
  useEffect(() => {
    const box = errorRef.current;
    if (send.kind !== "error" || !box) return;
    const bar = document.querySelector('nav[aria-label="Schnellzugriff"]');
    const barHeight = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
    const overflow = box.getBoundingClientRect().bottom - (window.innerHeight - barHeight - 16);
    if (overflow > 0) scrollTo(window.scrollY + overflow);
  }, [send.kind, scrollTo]);

  const patchDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const selectDate = useCallback(
    (date: string) => {
      patchDraft({ date, slotId: null, time: null });
      setSlotsFailed(false);
      const token = ++slotsRequest.current;
      provider
        ?.getAvailableSlots(date, draft.typeId)
        .then((result) => {
          if (token !== slotsRequest.current) return; // veraltete Antwort
          setSlots(result);
          setStep(2);
        })
        .catch(() => {
          // Im Kalender bleiben und es sagen – nie still „nichts frei“. Kam der
          // Abruf aus der Übersicht („Andere Zeit wählen“), zurück in den Kalender.
          if (token !== slotsRequest.current) return;
          setSlotsFailed(true);
          setStep(1);
        });
    },
    [provider, patchDraft, draft.typeId],
  );

  const submit = useCallback(async () => {
    if (!provider) return;
    setSend({ kind: "sending" });
    const result = await provider.createBooking(draft);
    if (!result.ok) setSend({ kind: "error", text: result.error, code: result.code });
    else if (result.method === "confirmed") setSend({ kind: "done", method: "confirmed", booked: result });
    else setSend({ kind: "done", method: result.method });
  }, [provider, draft]);

  // Zurück-Geste: ein eigener Verlaufseintrag, solange die Buchung unterwegs
  // ist. `onTop` – liegt er gerade obenauf? (Ein Sprunglink legt seinen
  // Eintrag darüber; dann führt „Zurück“ erst auf unseren Eintrag zurück.)
  const onTop = useRef(false);
  const flow = useRef({ step, send: send.kind });
  useEffect(() => {
    flow.current = { step, send: send.kind };
  }, [step, send.kind]);
  useEffect(() => {
    onTop.current = isBookingEntry(window.history.state);
    const onPop = (event: PopStateEvent) => {
      const left = onTop.current && !isBookingEntry(event.state);
      onTop.current = isBookingEntry(event.state);
      const { step: current, send: kind } = flow.current;
      // Nach der Buchung oder während sie läuft, bleibt die Karte stehen
      if (!left || current === 0 || kind === "done" || kind === "sending") return;
      setSend({ kind: "idle" });
      setStep(current - 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (step === 0 || send.kind === "done" || onTop.current) return;
    window.history.pushState({ booking: true }, "");
    onTop.current = true;
  }, [step, send.kind]);

  const reset = useCallback(() => {
    setDraft(emptyDraft);
    setSlots([]);
    setSlotsFailed(false);
    setSend({ kind: "idle" });
    setCalendarSaved(false);
    setStep(0);
  }, []);

  const slotDateLabel = draft.date
    ? slotDateFormat.format(
        (() => {
          const [y, m, d] = draft.date.split("-").map(Number);
          return new Date(y, m - 1, d);
        })(),
      )
    : "";

  // Richtung für die Bewegung (StepFrame): Weiter = +1, Zurück, „Termin
  // ändern" und „Weiteren Termin" = −1. Der Abschluss zählt als letzter Schritt.
  const paneIndex = send.kind === "done" ? bookingSteps.length : step;
  const [lastPane, setLastPane] = useState(paneIndex);
  const [direction, setDirection] = useState(1);
  if (paneIndex !== lastPane) {
    setDirection(paneIndex > lastPane ? 1 : -1);
    setLastPane(paneIndex);
  }

  // Bis der Provider steht, gilt der Wunschtermin – der ehrliche Default.
  // Ist die Website gegen das Cockpit gebaut, entscheidet erst dessen Antwort
  // zwischen Anfrage und Buchung: Titel und Hinweis bleiben bis dahin
  // unsichtbar (Platz reserviert), statt kurz das falsche Wort zu zeigen.
  // Ohne JavaScript antwortet nie jemand – dort zeigt <noscript> sie wieder.
  const mode = provider?.mode ?? "request";
  const confirmed = mode === "confirmed";
  const modePending = !provider && site.bookingProvider === "cockpit";
  // Handy: Der Modus-Hinweis steht nur im ersten Schritt – danach wäre er
  // bei jedem Schritt drei Zeilen Wiederholung vor dem eigentlichen Inhalt.
  const noteClass = cn(
    "mt-2.5 text-xs leading-relaxed text-ink/70",
    modePending && "invisible",
    step > 0 && "max-md:hidden",
  );

  return (
    <div
      ref={cardRef}
      data-booking-card
      className="rounded-2xl bg-white ring-1 ring-ink/8 shadow-[0_20px_50px_-30px_rgba(23,37,27,0.25)]"
    >
      <div className="border-b border-ink/8 px-6 py-5 md:px-8">
        {modePending && (
          <noscript>
            <style>{"[data-mode-pending]{visibility:visible}"}</style>
          </noscript>
        )}
        {/* Handy: Titel und Fortschritt immer untereinander – sonst wechselt die
            Kopfzeile je nach Schrittname zwischen ein und zwei Zeilen. */}
        <div className="flex flex-wrap items-center justify-between gap-3 max-md:flex-col max-md:items-start">
          <p
            data-mode-pending={modePending || undefined}
            className={cn(
              "text-xs font-semibold tracking-[0.18em] text-primary-deep uppercase",
              modePending && "invisible",
            )}
          >
            {confirmed ? bookingCopy.cardTitleConfirmed : bookingCopy.cardTitle}
          </p>
          <BookingProgress step={step} />
        </div>
        {mode === "request" && send.kind !== "done" && (
          <p data-mode-pending={modePending || undefined} className={noteClass}>
            {bookingCopy.requestModeNote}
          </p>
        )}
        {confirmed && send.kind !== "done" && (
          <p className={noteClass}>{bookingCopy.confirmedModeNote}</p>
        )}
        <noscript>
          <p className="mt-3 rounded-lg bg-mist px-3.5 py-2.5 text-sm leading-relaxed text-ink">
            {bookingCopy.noScript}{" "}
            <a href={site.phoneHref} className="font-medium whitespace-nowrap underline underline-offset-4">
              {site.phone}
            </a>
          </p>
        </noscript>
        {/* Die Praxis hat die Online-Buchung pausiert: ein ruhiger Satz, kein Alarm */}
        {provider?.notice && send.kind !== "done" && (
          <p
            role="note"
            className="mt-3 flex items-start gap-2 rounded-lg bg-mist px-3.5 py-2.5 text-xs leading-relaxed text-ink/75"
          >
            <Icon name="phone" size={14} className="mt-0.5 shrink-0 text-primary" />
            <span>{provider.notice}</span>
          </p>
        )}
      </div>

      <StepFrame
        paneKey={paneIndex}
        direction={direction}
        className="px-6 py-6 md:px-8 md:py-7"
      >
        {send.kind === "done" ? (
          <div>
            <p
              ref={setSuccess}
              tabIndex={-1}
              className="flex items-center gap-2.5 font-display text-xl font-medium text-ink outline-none"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-deep">
                <Icon name="check" size={16} />
              </span>
              {send.method === "confirmed"
                ? bookingCopy.confirm.successHeadingConfirmed
                : send.method === "mailto"
                  ? bookingCopy.confirm.successHeadingMailto
                  : bookingCopy.confirm.successHeading}
            </p>
            {/* Was, wann, wo – aus der Antwort des Cockpits, nicht aus der Eingabe */}
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
              {send.method === "confirmed"
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
                      setCalendarSaved(true);
                    }}
                    className={quietButton}
                  >
                    <Icon name="calendar" size={16} />
                    {bookingCopy.confirm.addToCalendar}
                  </button>
                  <a href="#praxis" className={quietButton}>
                    <Icon name="pin" size={16} />
                    {bookingCopy.confirm.directions}
                  </a>
                </div>
                <p role="status" className="mt-2 text-xs leading-relaxed text-ink/70">
                  {calendarSaved ? bookingCopy.confirm.calendarSaved : ""}
                </p>
              </>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={reset}
                className="min-h-11 text-left text-sm font-medium text-primary underline-offset-4 hover:underline sm:text-center"
              >
                {send.method === "confirmed" ? bookingCopy.confirm.newBooking : bookingCopy.confirm.newRequest}
              </button>
              {send.method !== "confirmed" && site.doctolibConfigured && (
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
        ) : (
          <div>
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  // Während gebucht wird, bleibt der Schritt stehen
                  onClick={() => send.kind !== "sending" && setStep((s) => s - 1)}
                  aria-disabled={send.kind === "sending" || undefined}
                  aria-label={bookingCopy.back}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink/70 transition-colors hover:border-primary/50 hover:text-ink max-md:size-11"
                >
                  <Icon name="arrow-right" size={15} className="rotate-180" />
                </button>
              )}
              <h3
                ref={setHeading}
                tabIndex={-1}
                className="font-display text-xl font-medium text-ink outline-none"
              >
                {bookingSteps[step].title}
              </h3>
            </div>

            <div className="mt-5">
              {step === 0 && (
                <StepTypes
                  types={appointmentTypes}
                  selected={draft.typeId}
                  onSelect={(typeId) => {
                    patchDraft({ typeId });
                    setSlotsFailed(false);
                    setStep(1);
                  }}
                />
              )}

              {step === 1 &&
                (provider ? (
                  <>
                    <StepCalendar
                      provider={provider}
                      typeId={draft.typeId}
                      selected={draft.date}
                      onSelect={selectDate}
                    />
                    {slotsFailed && draft.date && (
                      <div className="mt-4">
                        <LoadError onRetry={() => selectDate(draft.date!)} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-ink/70">Kalender wird geladen …</p>
                ))}

              {step === 2 && (
                <StepSlots
                  slots={slots}
                  selected={draft.slotId}
                  dateLabel={slotDateLabel}
                  mode={mode}
                  onSelect={(slot) => {
                    patchDraft({ slotId: slot.id, time: slot.time });
                    setStep(3);
                  }}
                />
              )}

              {step === 3 && (
                <StepDetails
                  draft={draft}
                  onChange={patchDraft}
                  onContinue={() => setStep(4)}
                />
              )}

              {step === 4 && provider && (
                <>
                  <StepConfirm
                    draft={draft}
                    mode={provider.mode}
                    sending={send.kind === "sending"}
                    onSubmit={() => void submit()}
                    onChange={() => setStep(1)}
                  />
                  {/* Fehler mit Ausweg: bei vergebener Zeit zurück zu den Zeiten
                      desselben Tages, sonst das Telefon */}
                  {send.kind === "error" && (
                    <div ref={errorRef} role="alert" className="mt-4 rounded-xl border border-ink/10 bg-mist/60 px-4 py-3 text-sm leading-relaxed">
                      <p className="font-medium text-red-800">{send.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-6">
                        {send.code === "slot_taken" && draft.date && (
                          <button
                            type="button"
                            onClick={() => {
                              setSend({ kind: "idle" });
                              selectDate(draft.date!);
                            }}
                            className="inline-flex min-h-11 items-center font-medium text-primary-deep underline underline-offset-4 hover:text-primary"
                          >
                            {bookingCopy.confirm.otherTime}
                          </button>
                        )}
                        <a
                          href={site.phoneHref}
                          className="inline-flex min-h-11 items-center gap-2 font-medium text-ink hover:text-primary-deep"
                        >
                          <Icon name="phone" size={16} className="text-primary-deep" />
                          {site.phone}
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Fallback, falls Provider gar nicht lädt (defensive) */}
            {step === 4 &&
              !provider &&
              (site.doctolibConfigured ? (
                <Button href={site.doctolibUrl} withArrow>
                  {bookingCopy.confirm.doctolibCta}
                </Button>
              ) : (
                <Button href={site.phoneHref} withArrow>
                  {site.phone}
                </Button>
              ))}
          </div>
        )}
      </StepFrame>

      {/*
       * Sofort verbindlicher Weg – ab Schritt 1 leise erreichbar, damit
       * niemand erst den ganzen Flow durchlaufen muss. Im verbindlichen
       * Modus bucht die Website selbst verbindlich; dann entfällt der Hinweis.
       */}
      {!confirmed && site.doctolibConfigured && send.kind !== "done" && step !== 4 && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-ink/8 px-6 py-2.5 md:px-8">
          <p className="text-xs text-ink/70">{bookingCopy.doctolibHint}</p>
          <a
            href={site.doctolibUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {bookingCopy.confirm.doctolibCta}
            <Icon name="arrow-right" size={13} />
          </a>
        </div>
      )}
    </div>
  );
}
