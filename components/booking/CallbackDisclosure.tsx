"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { terminSection } from "@/content/booking";
import { site } from "@/content/site";
import {
  callbackChannel,
  fetchCallbackToken,
  sendCallback,
  type CallbackChannel,
  type FormToken,
  type PreferredTime,
} from "@/lib/booking/callback";
import { sharedCockpitStatus } from "@/lib/booking/status";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

/**
 * Sekundäre Alternative zur Online-Buchung:
 * „Kein passender Termin dabei?" → kleines Rückruf-Formular (Vorname,
 * Nachname, Telefon, Wunschzeit) – nie ein Grund, nie Beschwerden.
 *
 * Betreibt die Praxis die Online-Buchung im Cockpit, landet die Bitte dort
 * im Posteingang „Anfragen“ (mit Einwilligung, Formular-Token und
 * Honigtopf; Referenz zur Bestätigung). Sonst bleibt es beim vorbereiteten
 * E-Mail-Entwurf – mit Telefon und E-Mail als Ersatz, falls sich kein
 * E-Mail-Programm öffnet (lib/booking/callback.ts).
 */

type FieldKey = "firstName" | "lastName" | "phone" | "consent";
type FieldErrors = Partial<Record<FieldKey, string>>;
const FIELD_ORDER = ["firstName", "lastName", "phone", "consent"] as const;

interface Values {
  firstName: string;
  lastName: string;
  phone: string;
  time: string;
  consent: boolean;
  /** Honigtopf – für Menschen unsichtbar, bleibt leer. */
  website: string;
}

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "mailto" }
  | { kind: "done"; ref: string }
  | { kind: "error"; text: string };

const copy = terminSection.callback;

function fieldError(key: FieldKey, v: Values, channel: CallbackChannel): string | undefined {
  if (key === "firstName") return v.firstName.trim() ? undefined : copy.errors.firstName;
  if (key === "lastName") return v.lastName.trim() ? undefined : copy.errors.lastName;
  if (key === "phone") return v.phone.replace(/\D/g, "").length >= 5 ? undefined : copy.errors.phone;
  return channel !== "cockpit" || v.consent ? undefined : copy.errors.consent;
}

// Wie die Felder der Buchung: weiß, 44 px, rounded-xl. Der globale Fokusring
// (app/globals.css, ohne Layer) setzt sonst 2 px Radius.
const inputClass = (invalid: boolean) =>
  cn(
    "min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-ink transition-colors focus:border-primary focus-visible:rounded-xl!",
    invalid ? "border-red-700" : "border-ink/12",
  );

export function CallbackDisclosure() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CallbackChannel>("mailto");
  const [values, setValues] = useState<Values>({
    firstName: "",
    lastName: "",
    phone: "",
    time: copy.timeOptions[0],
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  // Laufender oder fertiger Abruf des Formular-Tokens (ein Abruf je Absenden)
  const token = useRef<Promise<FormToken | null> | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  // Wohin geht die Bitte? Derselbe Status-Abruf wie für Buchung und Sprechzeit.
  useEffect(() => {
    if (site.bookingProvider !== "cockpit") return;
    let cancelled = false;
    void sharedCockpitStatus(site.cockpitApiUrl).then((status) => {
      if (!cancelled) setChannel(callbackChannel(status));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Das Formular-Token schon beim Aufklappen holen: Bis zum Absenden ist es
  // die verlangten drei Sekunden alt, niemand wartet.
  useEffect(() => {
    if (!open || channel !== "cockpit" || token.current) return;
    token.current = fetchCallbackToken(site.cockpitApiUrl);
  }, [open, channel]);

  // Abgeschickt: Das Formular weicht der Bestätigung, der Fokus geht mit.
  useEffect(() => {
    if (send.kind === "done") doneRef.current?.focus();
  }, [send.kind]);

  // Korrigiert? Dann verschwindet die Meldung des Feldes gleich beim Tippen.
  const update = useCallback(
    (key: keyof Values, value: string | boolean) => {
      const next = { ...values, [key]: value };
      setValues(next);
      if (key in errors && !fieldError(key as FieldKey, next, channel)) {
        const rest = { ...errors };
        delete rest[key as FieldKey];
        setErrors(rest);
      }
    },
    [values, errors, channel],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (send.kind === "sending") return;
    const next: FieldErrors = {};
    for (const key of FIELD_ORDER) {
      const error = fieldError(key, values, channel);
      if (error) next[key] = error;
    }
    setErrors(next);
    const firstInvalid = FIELD_ORDER.find((key) => next[key]);
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`#callback-${firstInvalid}`)?.focus();
      return;
    }
    const name = `${values.firstName.trim()} ${values.lastName.trim()}`;

    if (channel === "mailto") {
      const subject = encodeURIComponent(copy.mailSubject);
      const body = encodeURIComponent(
        [`Name: ${name}`, `Telefon: ${values.phone.trim()}`, `Bevorzugte Zeit: ${values.time}`].join("\n"),
      );
      window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
      setSend({ kind: "mailto" });
      return;
    }

    setSend({ kind: "sending" });
    const formToken = token.current ? await token.current : null;
    token.current = null;
    const result = await sendCallback(
      site.cockpitApiUrl,
      {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        preferredTime: values.time.toLowerCase() as PreferredTime,
        consent: values.consent,
        hp: values.website,
      },
      formToken,
    );
    if (result.ok) setSend({ kind: "done", ref: result.ref });
    else setSend({ kind: "error", text: result.message ?? copy.errors.send });
  }

  const textField = (key: "firstName" | "lastName" | "phone", label: string, type: string, autoComplete: string) => (
    <div>
      <label htmlFor={`callback-${key}`} className="mb-1.5 block text-sm font-medium">
        {label} <span aria-hidden="true">*</span>
      </label>
      <input
        id={`callback-${key}`}
        name={key}
        type={type}
        autoComplete={autoComplete}
        autoCapitalize={key === "phone" ? undefined : "words"}
        required
        aria-required="true"
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `callback-${key}-error` : undefined}
        value={values[key]}
        onChange={(event) => update(key, event.target.value)}
        className={inputClass(Boolean(errors[key]))}
      />
      {errors[key] && (
        <p id={`callback-${key}-error`} className="mt-1.5 text-sm text-red-800">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{copy.question}</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="callback-form"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {open ? copy.close : copy.open}
          <Icon
            name="arrow-down"
            size={14}
            className={cn("transition-transform duration-300", open && "rotate-180")}
          />
        </button>
      </div>

      {open && send.kind === "done" && (
        <div
          id="callback-form"
          ref={doneRef}
          tabIndex={-1}
          role="status"
          className="animate-step-in mt-4 flex items-start gap-2.5 rounded-xl bg-mist/60 px-4 py-3.5 text-sm leading-relaxed text-ink outline-none"
        >
          <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary-deep" />
          <p>
            {copy.successCockpit} <span className="font-semibold tabular-nums">{send.ref}</span>
          </p>
        </div>
      )}

      {open && send.kind !== "done" && (
        <form
          id="callback-form"
          onSubmit={handleSubmit}
          noValidate
          className="animate-step-in relative mt-4 space-y-3.5"
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            {textField("firstName", copy.firstName, "text", "given-name")}
            {textField("lastName", copy.lastName, "text", "family-name")}
            {textField("phone", copy.phone, "tel", "tel")}
            <div>
              <label htmlFor="callback-time" className="mb-1.5 block text-sm font-medium">
                {copy.timeLabel}
              </label>
              <select
                id="callback-time"
                name="time"
                value={values.time}
                onChange={(event) => update("time", event.target.value)}
                className={inputClass(false)}
              >
                {copy.timeOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {channel === "cockpit" && (
            <div>
              <label htmlFor="callback-consent" className="flex gap-3 text-sm leading-relaxed">
                <input
                  id="callback-consent"
                  type="checkbox"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={errors.consent ? "callback-consent-error" : undefined}
                  checked={values.consent}
                  onChange={(event) => update("consent", event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 rounded accent-primary"
                />
                <span>
                  {copy.consentPrefix}{" "}
                  <Link href="/datenschutz/" className="font-medium text-primary underline underline-offset-2">
                    {copy.consentLinkLabel}
                  </Link>{" "}
                  {copy.consentSuffix}
                </span>
              </label>
              {errors.consent && (
                <p id="callback-consent-error" className="mt-1.5 text-sm text-red-800">
                  {errors.consent}
                </p>
              )}
            </div>
          )}

          {/* Honigtopf: für Menschen unsichtbar und nicht fokussierbar */}
          <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="callback-website">Website (bitte leer lassen)</label>
            <input
              id="callback-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(event) => update("website", event.target.value)}
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            withArrow
            loading={send.kind === "sending"}
            loadingLabel={copy.sending}
            className="!px-5 !py-2"
          >
            {copy.submit}
          </Button>

          {send.kind === "error" && (
            <div role="alert" className="rounded-xl border border-ink/10 bg-mist/60 px-4 py-3 text-sm leading-relaxed">
              <p className="font-medium text-red-800">{send.text}</p>
              <a
                href={site.phoneHref}
                className="mt-1 inline-flex min-h-11 items-center gap-2 font-medium text-ink hover:text-primary-deep"
              >
                <Icon name="phone" size={16} className="text-primary-deep" />
                {site.phone}
              </a>
            </div>
          )}

          <div role="status" className={cn("text-sm leading-relaxed", send.kind !== "mailto" && "sr-only")}>
            {send.kind === "mailto" && (
              <>
                <p className="text-primary-deep">{copy.success}</p>
                <p className="mt-1.5 text-ink/70">
                  {copy.fallbackLead} (
                  <a href={site.phoneHref} className="font-medium whitespace-nowrap text-ink underline underline-offset-4 hover:text-primary-deep">
                    {site.phone}
                  </a>
                  ) {copy.fallbackOr}{" "}
                  <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4 hover:text-primary-deep">
                    {site.email}
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
