"use client";

import { useBookingDialog } from "@/components/booking/BookingDialogProvider";
import { EarliestFree } from "@/components/booking/EarliestFree";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { bookingCopy, bookingDialog, bookingSteps } from "@/content/booking";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { opensBooking } from "@/lib/booking/openers";

/**
 * Startkarte der Termin-Sektion. Die Buchung selbst lebt im Termin-Dialog
 * (genau einmal, für die ganze Website) – hier stehen nur, was einen
 * erwartet (die fünf Schritte, verbindlich oder Anfrage), der früheste freie
 * Tag und der Knopf, der den Dialog öffnet.
 *
 * Ohne JavaScript gibt es keinen Dialog: Dann ersetzt der Hinweis mit dem
 * Telefon den Knopf.
 */
export function BookingLauncher() {
  const { flow } = useBookingDialog();
  const { mode, modePending, provider } = flow;
  // Kartentitel und Hinweis nennen den echten Modus (bis zur Antwort unsichtbar);
  // der Knopf steht sofort – mit dem Wort, das gegen das Cockpit gilt.
  const confirmed = mode === "confirmed";
  const books = provider ? confirmed : site.bookingProvider === "cockpit";

  return (
    <div
      data-booking-card
      className="rounded-2xl bg-white px-6 py-7 ring-1 ring-ink/8 shadow-[0_20px_50px_-30px_rgba(23,37,27,0.25)] md:px-8 md:py-8"
    >
      <noscript>
        <style>{"[data-booking-launch]{display:none!important}[data-mode-pending]{visibility:visible!important}"}</style>
      </noscript>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-primary-deep"
        >
          <Icon name="calendar" size={18} />
        </span>
        <p
          data-mode-pending={modePending || undefined}
          className={cn(
            "text-xs font-semibold tracking-[0.18em] text-primary-deep uppercase",
            modePending && "invisible",
          )}
        >
          {confirmed ? bookingCopy.cardTitleConfirmed : bookingCopy.cardTitle}
        </p>
      </div>

      <p
        data-mode-pending={modePending || undefined}
        className={cn("mt-4 text-sm leading-relaxed text-ink/70", modePending && "invisible")}
      >
        {confirmed ? bookingCopy.confirmedModeNote : bookingCopy.requestModeNote}
      </p>

      <ol className="mt-5 grid gap-2.5 border-t border-ink/8 pt-5 sm:grid-cols-2">
        {bookingSteps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-3 text-sm text-ink/80">
            <span className="font-display flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary-deep tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            {step.short}
          </li>
        ))}
      </ol>

      {/* Die Praxis hat die Online-Buchung pausiert: ein ruhiger Satz, kein Alarm */}
      {provider?.notice && (
        <p
          role="note"
          className="mt-5 flex items-start gap-2 rounded-lg bg-mist px-3.5 py-2.5 text-xs leading-relaxed text-ink/75"
        >
          <Icon name="phone" size={14} className="mt-0.5 shrink-0 text-primary" />
          <span>{provider.notice}</span>
        </p>
      )}

      <div data-booking-launch className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button href="/#kontakt" {...opensBooking()} withArrow className="w-full sm:w-auto">
          {books ? bookingDialog.launch : bookingDialog.launchRequest}
        </Button>
        <EarliestFree tone="light" />
      </div>

      <noscript>
        <p className="mt-6 rounded-lg bg-mist px-3.5 py-2.5 text-sm leading-relaxed text-ink">
          {bookingCopy.noScript}{" "}
          <a href={site.phoneHref} className="font-medium whitespace-nowrap underline underline-offset-4">
            {site.phone}
          </a>
        </p>
      </noscript>
    </div>
  );
}
