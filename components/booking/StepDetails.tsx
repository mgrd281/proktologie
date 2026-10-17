"use client";

import { cn } from "@/lib/cn";
import { bookingCopy } from "@/content/booking";
import type { BookingDraft } from "@/lib/booking/types";
import Link from "next/link";
import { useState, type FormEvent } from "react";

/**
 * Schritt 4: Minimal nötige Kontaktdaten (kein Geburtsdatum, keine
 * medizinischen Details). Inline-Validierung direkt unter dem Feld,
 * Fokus springt aufs erste fehlerhafte Feld, Sammelmeldung in einer
 * role=alert-Region. Ist ein Feld korrigiert, verschwindet seine Meldung
 * sofort – neue Meldungen gibt es erst wieder beim Weiter-Klick. Eingaben
 * bleiben beim Vor/Zurück und nach dem Schließen erhalten (der Entwurf liegt
 * in lib/booking/useBookingFlow.ts).
 *
 * „Weiter“ steht im Fuß des Dialogs und schickt dieses Formular ab
 * (`form`-Attribut) – Enter in einem Feld tut dasselbe.
 */

type FieldKey = "firstName" | "lastName" | "email" | "phone" | "consent";
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FIELD_ORDER = ["firstName", "lastName", "email", "phone", "consent"] as const;

function fieldError(key: FieldKey, draft: BookingDraft): string | undefined {
  if (key === "firstName") return draft.firstName.trim() ? undefined : bookingCopy.errors.firstName;
  if (key === "lastName") return draft.lastName.trim() ? undefined : bookingCopy.errors.lastName;
  if (key === "email") return EMAIL_PATTERN.test(draft.email.trim()) ? undefined : bookingCopy.errors.email;
  if (key === "phone") return draft.phone.trim() ? undefined : bookingCopy.errors.phone;
  return draft.consent ? undefined : bookingCopy.errors.consent;
}

interface StepDetailsProps {
  /** id des Formulars – der Weiter-Knopf im Dialog-Fuß verweist darauf */
  formId: string;
  draft: BookingDraft;
  onChange: (patch: Partial<BookingDraft>) => void;
  onContinue: () => void;
}

export function StepDetails({ formId, draft, onChange, onContinue }: StepDetailsProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState("");
  const copy = bookingCopy.details;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: FieldErrors = {};
    for (const key of FIELD_ORDER) {
      const error = fieldError(key, draft);
      if (error) next[key] = error;
    }
    setErrors(next);

    const firstInvalid = FIELD_ORDER.find((key) => next[key]);
    if (firstInvalid) {
      setSummary(bookingCopy.errors.summary);
      event.currentTarget
        .querySelector<HTMLElement>(`#booking-${firstInvalid}`)
        ?.focus();
      return;
    }
    setSummary("");
    onContinue();
  }

  // Korrigiert? Dann verschwindet die Meldung des Feldes gleich beim Tippen.
  function update(key: FieldKey, patch: Partial<BookingDraft>) {
    onChange(patch);
    if (!errors[key] || fieldError(key, { ...draft, ...patch })) return;
    const rest = { ...errors };
    delete rest[key];
    setErrors(rest);
    if (Object.keys(rest).length === 0) setSummary("");
  }

  const inputClasses = (key: FieldKey) =>
    cn(
      // Der globale Fokusring (app/globals.css, ohne Layer) setzt 2 px Radius
      // und schlägt damit jede Utility – das Feld würde beim Antippen eckig.
      // Gefülltes Feld wie in Apps; der Rand (ink/50) erreicht 3:1 – so bleibt das
      // Feld als Feld erkennbar (WCAG 1.4.11). Beim Tippen wird es weiß.
      "w-full min-h-12 rounded-xl border bg-mist px-4 py-2.5 text-ink transition-colors focus:border-primary focus:bg-white focus-visible:rounded-xl!",
      errors[key] ? "border-red-700" : "border-ink/50",
    );

  const field = (
    key: Exclude<FieldKey, "consent">,
    label: string,
    type: string,
    autoComplete: string,
    // Namen groß, E-Mail klein und ohne Autokorrektur (Handy-Tastatur)
    autoCapitalize: "words" | "none" | undefined,
  ) => (
    <div>
      <label htmlFor={`booking-${key}`} className="mb-1.5 block text-sm font-medium">
        {label} <span aria-hidden="true">*</span>
      </label>
      <input
        id={`booking-${key}`}
        type={type}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        autoCorrect={key === "email" ? "off" : undefined}
        spellCheck={key === "email" ? false : undefined}
        required
        aria-required="true"
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `booking-${key}-error` : undefined}
        value={draft[key]}
        onChange={(event) => update(key, { [key]: event.target.value })}
        className={inputClasses(key)}
      />
      {errors[key] && (
        <p id={`booking-${key}-error`} className="mt-1.5 text-sm text-red-800">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="relative space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("firstName", copy.firstName, "text", "given-name", "words")}
        {field("lastName", copy.lastName, "text", "family-name", "words")}
      </div>
      {field("email", copy.email, "email", "email", "none")}
      {field("phone", copy.phone, "tel", "tel", undefined)}

      <p className="text-xs leading-relaxed text-ink/70">{copy.privacyNote}</p>

      <div>
        <label htmlFor="booking-consent" className="flex gap-3 text-sm leading-relaxed">
          <input
            id="booking-consent"
            type="checkbox"
            required
            aria-required="true"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "booking-consent-error" : undefined}
            checked={draft.consent}
            onChange={(event) => update("consent", { consent: event.target.checked })}
            className="mt-0.5 size-5 shrink-0 rounded accent-primary"
          />
          {/* Der Link ersetzt die Erwähnung im Satz – kein doppelter Link */}
          <span>
            {copy.consentPrefix}{" "}
            <Link
              href="/datenschutz/"
              className="font-medium text-primary underline underline-offset-2"
            >
              {copy.consentLinkLabel}
            </Link>{" "}
            {copy.consentSuffix}
          </span>
        </label>
        {errors.consent && (
          <p id="booking-consent-error" className="mt-1.5 text-sm text-red-800">
            {errors.consent}
          </p>
        )}
      </div>

      {/* Honigtopf: für Menschen unsichtbar und nicht fokussierbar, für
          Screenreader ausgeblendet – füllt ihn ein Bot, lehnt die API ab. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor="booking-website">Website (bitte leer lassen)</label>
        <input
          id="booking-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={draft.website ?? ""}
          onChange={(event) => onChange({ website: event.target.value })}
        />
      </div>

      <p role="alert" className={cn("text-sm font-medium text-red-800", !summary && "sr-only")}>
        {summary}
      </p>
    </form>
  );
}
