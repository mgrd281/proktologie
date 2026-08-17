"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { kontakt } from "@/content/sections";
import { site } from "@/content/site";
import Link from "next/link";
import { useState, type FormEvent } from "react";

/**
 * Terminanfrage-Formular ohne Backend-Zwang:
 * – `site.formEndpoint` gesetzt  -> POST an den Endpoint (Formspree o. Ä.)
 * – `site.formEndpoint` = null   -> öffnet das E-Mail-Programm mit
 *                                   vorbefüllter Anfrage (mailto)
 * Hinweis im Formular: keine sensiblen Gesundheitsdaten übermitteln.
 */

interface FieldErrors {
  name?: string;
  contact?: string;
  consent?: string;
}

export function ContactForm() {
  const f = kontakt.form;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "success"; text: string } | { kind: "error"; text: string }
  >({ kind: "idle" });
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const contact = String(data.get("contact") ?? "").trim();
    const callback = data.get("callback") === "on";
    const time = String(data.get("time") ?? "");
    const message = String(data.get("message") ?? "").trim();
    const consent = data.get("consent") === "on";

    const nextErrors: FieldErrors = {};
    if (!name) nextErrors.name = f.errors.name;
    if (!contact) nextErrors.contact = f.errors.contact;
    if (!consent) nextErrors.consent = f.errors.consent;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus({ kind: "idle" });
      return;
    }

    const lines = [
      `Name: ${name}`,
      `Kontakt: ${contact}`,
      callback ? `Rückruf erbeten: ja (${time})` : "Rückruf erbeten: nein",
      message ? `Nachricht: ${message}` : null,
    ].filter(Boolean);

    if (site.formEndpoint) {
      try {
        setSending(true);
        const response = await fetch(site.formEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name, contact, callback, time, message }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setStatus({ kind: "success", text: f.successEndpoint });
        form.reset();
      } catch {
        setStatus({ kind: "error", text: f.error });
      } finally {
        setSending(false);
      }
      return;
    }

    // mailto-Variante: funktioniert ohne Server
    const subject = encodeURIComponent("Terminanfrage über die Website");
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
    setStatus({ kind: "success", text: f.successMailto });
  }

  const inputClasses =
    "w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink/40 focus:border-primary";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="kontakt-name" className="mb-1.5 block text-sm font-medium">
          {f.name} <span aria-hidden="true">*</span>
        </label>
        <input
          id="kontakt-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "kontakt-name-error" : undefined}
          className={cn(inputClasses, errors.name && "border-red-700")}
        />
        {errors.name && (
          <p id="kontakt-name-error" className="mt-1.5 text-sm text-red-800">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="kontakt-contact" className="mb-1.5 block text-sm font-medium">
          {f.contact} <span aria-hidden="true">*</span>
        </label>
        <input
          id="kontakt-contact"
          name="contact"
          type="text"
          autoComplete="tel email"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.contact)}
          aria-describedby={errors.contact ? "kontakt-contact-error" : undefined}
          className={cn(inputClasses, errors.contact && "border-red-700")}
        />
        {errors.contact && (
          <p id="kontakt-contact-error" className="mt-1.5 text-sm text-red-800">
            {errors.contact}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <label htmlFor="kontakt-callback" className="flex min-h-11 items-center gap-3 text-sm">
          <input
            id="kontakt-callback"
            name="callback"
            type="checkbox"
            defaultChecked
            className="size-5 rounded accent-primary"
          />
          {f.callback}
        </label>
        <div className="flex items-center gap-3">
          <label htmlFor="kontakt-time" className="text-sm font-medium">
            {f.timeLabel}
          </label>
          <select
            id="kontakt-time"
            name="time"
            className="min-h-11 rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            {f.timeOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="kontakt-message" className="mb-1.5 block text-sm font-medium">
          {f.message}
        </label>
        <textarea
          id="kontakt-message"
          name="message"
          rows={4}
          aria-describedby="kontakt-message-hint"
          className={inputClasses}
        />
        <p id="kontakt-message-hint" className="mt-1.5 text-sm text-ink/60">
          {f.messageHint}
        </p>
      </div>

      <div>
        <label htmlFor="kontakt-consent" className="flex gap-3 text-sm leading-relaxed">
          <input
            id="kontakt-consent"
            name="consent"
            type="checkbox"
            required
            aria-required="true"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "kontakt-consent-error" : undefined}
            className="mt-0.5 size-5 shrink-0 rounded accent-primary"
          />
          <span>
            {f.consent}{" "}
            <Link
              href="/datenschutz/"
              className="font-medium text-primary underline underline-offset-2"
            >
              {f.consentLinkLabel}
            </Link>
          </span>
        </label>
        {errors.consent && (
          <p id="kontakt-consent-error" className="mt-1.5 text-sm text-red-800">
            {errors.consent}
          </p>
        )}
      </div>

      <div className="pt-2">
        <Button type="submit" withArrow disabled={sending}>
          {f.submit}
        </Button>
      </div>

      <p
        role={status.kind === "error" ? "alert" : "status"}
        className={cn(
          "text-sm",
          status.kind === "success" && "text-primary",
          status.kind === "error" && "text-red-800",
          status.kind === "idle" && "sr-only",
        )}
      >
        {status.kind === "idle" ? "" : status.text}
      </p>
    </form>
  );
}
