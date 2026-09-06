"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { bookingCopy } from "@/content/booking";
import type { BookingDraft } from "@/lib/booking/types";
import Link from "next/link";
import { useState, type FormEvent } from "react";

/**
 * Schritt 4: Minimal nötige Kontaktdaten (kein Geburtsdatum, keine
 * medizinischen Details). Inline-Validierung direkt unter dem Feld,
 * Fokus springt aufs erste fehlerhafte Feld, Sammelmeldung in einer
 * role=alert-Region. Eingaben bleiben beim Vor/Zurück erhalten
 * (Draft-State liegt in BookingCard).
 */

type FieldKey = "firstName" | "lastName" | "email" | "phone" | "consent";
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface StepDetailsProps {
  draft: BookingDraft;
  onChange: (patch: Partial<BookingDraft>) => void;
  onContinue: () => void;
}

export function StepDetails({ draft, onChange, onContinue }: StepDetailsProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState("");
  const copy = bookingCopy.details;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: FieldErrors = {};
    if (!draft.firstName.trim()) next.firstName = bookingCopy.errors.firstName;
    if (!draft.lastName.trim()) next.lastName = bookingCopy.errors.lastName;
    if (!EMAIL_PATTERN.test(draft.email.trim()))
      next.email = bookingCopy.errors.email;
    if (!draft.phone.trim()) next.phone = bookingCopy.errors.phone;
    if (!draft.consent) next.consent = bookingCopy.errors.consent;
    setErrors(next);

    const firstInvalid = (
      ["firstName", "lastName", "email", "phone", "consent"] as const
    ).find((key) => next[key]);
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

  const inputClasses = (key: FieldKey) =>
    cn(
      "w-full min-h-11 rounded-xl border bg-white px-4 py-2.5 text-ink transition-colors focus:border-primary",
      errors[key] ? "border-red-700" : "border-ink/12",
    );

  const field = (
    key: Exclude<FieldKey, "consent">,
    label: string,
    type: string,
    autoComplete: string,
  ) => (
    <div>
      <label htmlFor={`booking-${key}`} className="mb-1.5 block text-sm font-medium">
        {label} <span aria-hidden="true">*</span>
      </label>
      <input
        id={`booking-${key}`}
        type={type}
        autoComplete={autoComplete}
        required
        aria-required="true"
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `booking-${key}-error` : undefined}
        value={draft[key]}
        onChange={(event) => onChange({ [key]: event.target.value })}
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
    <form onSubmit={handleSubmit} noValidate className="relative space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("firstName", copy.firstName, "text", "given-name")}
        {field("lastName", copy.lastName, "text", "family-name")}
      </div>
      {field("email", copy.email, "email", "email")}
      {field("phone", copy.phone, "tel", "tel")}

      <p className="text-xs leading-relaxed text-ink/60">{copy.privacyNote}</p>

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
            onChange={(event) => onChange({ consent: event.target.checked })}
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

      <div className="pt-1">
        <Button type="submit" withArrow className="w-full sm:w-auto">
          {copy.continue}
        </Button>
      </div>
    </form>
  );
}
