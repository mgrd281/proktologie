"use client";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { StepCalendar } from "@/components/booking/StepCalendar";
import { StepConfirm } from "@/components/booking/StepConfirm";
import { StepDetails } from "@/components/booking/StepDetails";
import { StepSlots } from "@/components/booking/StepSlots";
import { StepTypes } from "@/components/booking/StepTypes";
import { appointmentTypes, bookingCopy, bookingSteps } from "@/content/booking";
import type { BookingProvider } from "@/lib/booking/provider";
import { createBookingProvider } from "@/lib/booking/provider";
import type { BookingDraft, BookingSlot } from "@/lib/booking/types";
import { site } from "@/content/site";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Orchestrator der Terminbuchung: Schritt-State, Draft-State (Eingaben
 * bleiben beim Vor/Zurück erhalten), Fokus-Management und Abschluss.
 * Sämtliche Verfügbarkeit kommt über das BookingProvider-Interface –
 * hier ist nichts hartkodiert. Alle Daten bleiben clientseitig
 * (kein localStorage, keine URLs mit Personenbezug, kein Logging).
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
};

const slotDateFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; method: "mailto" | "endpoint" }
  | { kind: "error"; text: string };

export function BookingCard() {
  const [provider, setProvider] = useState<BookingProvider | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const mounted = useRef(false);
  // Latest-wins-Token: schützt vor veralteten Slot-Antworten, falls ein
  // künftiger Provider asynchron/netzwerkbasiert antwortet.
  const slotsRequest = useRef(0);

  useEffect(() => {
    void createBookingProvider().then(setProvider);
  }, []);

  // Fokus-Management: Schrittwechsel → Schritt-Überschrift; Abschluss →
  // Erfolgs-Überschrift. Während „sending"/„error" wird NICHT umfokussiert.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (send.kind === "done") successRef.current?.focus();
    else if (send.kind === "idle") headingRef.current?.focus();
  }, [step, send.kind]);

  const patchDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const selectDate = useCallback(
    (date: string) => {
      patchDraft({ date, slotId: null, time: null });
      const token = ++slotsRequest.current;
      provider
        ?.getAvailableSlots(date)
        .then((result) => {
          if (token !== slotsRequest.current) return; // veraltete Antwort
          setSlots(result);
          setStep(2);
        })
        .catch(() => {
          /* Fehler: im Kalender bleiben, keine falschen Zeiten anzeigen */
        });
    },
    [provider, patchDraft],
  );

  const submit = useCallback(async () => {
    if (!provider) return;
    setSend({ kind: "sending" });
    const result = await provider.createBooking(draft);
    if (result.ok) setSend({ kind: "done", method: result.method });
    else setSend({ kind: "error", text: result.error });
  }, [provider, draft]);

  const reset = useCallback(() => {
    setDraft(emptyDraft);
    setSlots([]);
    setSend({ kind: "idle" });
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

  return (
    <div className="rounded-2xl bg-white ring-1 ring-ink/8 shadow-[0_20px_50px_-30px_rgba(23,37,27,0.25)]">
      <div className="border-b border-ink/8 px-6 py-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary-deep uppercase">
            {bookingCopy.cardTitle}
          </p>
          <BookingProgress step={step} />
        </div>
        {provider?.mode === "request" && send.kind !== "done" && (
          <p className="mt-2.5 text-xs leading-relaxed text-ink/55">
            {bookingCopy.requestModeNote}
          </p>
        )}
      </div>

      <div className="px-6 py-6 md:px-8 md:py-7">
        {send.kind === "done" ? (
          <div key="done" className="animate-step-in">
            <p
              ref={successRef}
              tabIndex={-1}
              className="flex items-center gap-2.5 font-display text-xl font-medium text-ink outline-none"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-deep">
                <Icon name="check" size={16} />
              </span>
              {send.method === "mailto"
                ? bookingCopy.confirm.successHeadingMailto
                : bookingCopy.confirm.successHeading}
            </p>
            <p role="status" className="mt-4 text-sm leading-relaxed text-ink/70">
              {send.method === "mailto"
                ? bookingCopy.confirm.successMailto
                : bookingCopy.confirm.successEndpoint}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={reset}
                className="min-h-11 text-left text-sm font-medium text-primary underline-offset-4 hover:underline sm:text-center"
              >
                {bookingCopy.confirm.newRequest}
              </button>
              {site.doctolibConfigured && (
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
          <div key={step} className="animate-step-in">
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  aria-label={bookingCopy.back}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink/70 transition-colors hover:border-primary/50 hover:text-ink"
                >
                  <Icon name="arrow-right" size={15} className="rotate-180" />
                </button>
              )}
              <h3
                ref={headingRef}
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
                    setStep(1);
                  }}
                />
              )}

              {step === 1 &&
                (provider ? (
                  <StepCalendar
                    provider={provider}
                    selected={draft.date}
                    onSelect={selectDate}
                  />
                ) : (
                  <p className="text-sm text-ink/60">Kalender wird geladen …</p>
                ))}

              {step === 2 && (
                <StepSlots
                  slots={slots}
                  selected={draft.slotId}
                  dateLabel={slotDateLabel}
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
                  {send.kind === "error" && (
                    <p role="alert" className="mt-4 text-sm font-medium text-red-800">
                      {send.text}
                    </p>
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
      </div>
    </div>
  );
}
