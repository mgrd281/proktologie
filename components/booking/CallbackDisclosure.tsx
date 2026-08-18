"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { terminSection } from "@/content/booking";
import { site } from "@/content/site";
import { useState, type FormEvent } from "react";

/**
 * Sekundäre Alternative zur Online-Terminanfrage:
 * „Kein passender Termin dabei?" → kleines, elegantes Rückruf-Formular
 * (Name, Telefonnummer, Zeitfenster). Versand per mailto – ohne Server,
 * ohne Speicherung.
 */
export function CallbackDisclosure() {
  const copy = terminSection.callback;
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const time = String(data.get("time") ?? "");
    const next: { name?: string; phone?: string } = {};
    if (!name) next.name = copy.errors.name;
    if (!phone) next.phone = copy.errors.phone;
    setErrors(next);
    if (next.name || next.phone) {
      event.currentTarget
        .querySelector<HTMLElement>(next.name ? "#callback-name" : "#callback-phone")
        ?.focus();
      return;
    }
    const subject = encodeURIComponent(copy.mailSubject);
    const body = encodeURIComponent(
      [`Name: ${name}`, `Telefon: ${phone}`, `Bevorzugte Zeit: ${time}`].join("\n"),
    );
    window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
    setSent(true);
  }

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

      {open && (
        <form
          id="callback-form"
          onSubmit={handleSubmit}
          noValidate
          className="animate-step-in mt-4 space-y-3.5"
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="callback-name" className="mb-1 block text-sm font-medium">
                {copy.name} <span aria-hidden="true">*</span>
              </label>
              <input
                id="callback-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "callback-name-error" : undefined}
                className={cn(
                  "min-h-11 w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-ink focus:border-primary",
                  errors.name ? "border-red-700" : "border-ink/12",
                )}
              />
              {errors.name && (
                <p id="callback-name-error" className="mt-1 text-xs text-red-800">
                  {errors.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="callback-phone" className="mb-1 block text-sm font-medium">
                {copy.phone} <span aria-hidden="true">*</span>
              </label>
              <input
                id="callback-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "callback-phone-error" : undefined}
                className={cn(
                  "min-h-11 w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-ink focus:border-primary",
                  errors.phone ? "border-red-700" : "border-ink/12",
                )}
              />
              {errors.phone && (
                <p id="callback-phone-error" className="mt-1 text-xs text-red-800">
                  {errors.phone}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="callback-time" className="text-sm font-medium">
              {copy.timeLabel}
            </label>
            <select
              id="callback-time"
              name="time"
              className="min-h-11 rounded-lg border border-ink/12 bg-white px-3 py-1.5 text-sm"
            >
              {copy.timeOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <Button type="submit" withArrow className="!min-h-11 !px-5 !py-2 !text-sm">
            {copy.submit}
          </Button>

          <p role="status" className={cn("text-sm text-primary-deep", !sent && "sr-only")}>
            {sent ? copy.success : ""}
          </p>
        </form>
      )}
    </div>
  );
}
