import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { appointmentTypes, bookingCopy } from "@/content/booking";
import { site } from "@/content/site";
import type { BookingDraft, BookingProviderMode } from "@/lib/booking/types";

/**
 * Schritt 5: Übersicht + Abschluss.
 * Im „request"-Modus heißt der Primär-CTA ehrlich „Terminanfrage senden";
 * erst ein Provider mit mode="confirmed" schaltet auf
 * „Termin verbindlich buchen" um. Daneben immer der offizielle
 * Doctolib-Weg für sofort verbindliche Buchungen.
 */

interface StepConfirmProps {
  draft: BookingDraft;
  mode: BookingProviderMode;
  sending: boolean;
  onSubmit: () => void;
  onChange: () => void;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function StepConfirm({
  draft,
  mode,
  sending,
  onSubmit,
  onChange,
}: StepConfirmProps) {
  const copy = bookingCopy.confirm;
  const type = appointmentTypes.find((t) => t.id === draft.typeId);
  const [y, m, d] = (draft.date ?? "").split("-").map(Number);
  const dateLabel = draft.date ? dateFormat.format(new Date(y, m - 1, d)) : "–";

  const rows: [string, string][] = [
    ["Terminart", type?.label ?? "–"],
    ["Datum", dateLabel],
    ["Uhrzeit", draft.time ? `${draft.time} Uhr` : "–"],
    [copy.practice, site.name],
    [copy.doctor, site.doctor],
  ];

  return (
    <div>
      <p className="flex items-center gap-2.5 text-sm font-medium text-primary-deep">
        <Icon name="check" size={16} />
        {copy.heading}
      </p>

      <dl className="mt-5 divide-y divide-ink/8 rounded-xl border border-ink/10 bg-mist/40 px-5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-6 py-3">
            <dt className="text-xs font-medium tracking-wide text-ink/55 uppercase">
              {label}
            </dt>
            <dd className="text-right text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {mode === "request" && (
        <p className="mt-4 text-xs leading-relaxed text-ink/60">
          {copy.requestHint}
        </p>
      )}
      {mode === "confirmed" && (
        <p className="mt-4 text-xs leading-relaxed text-ink/60">
          {copy.confirmedHint}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          withArrow
          disabled={sending}
          onClick={onSubmit}
          className={cn("w-full sm:w-auto", sending && "opacity-60")}
        >
          {mode === "confirmed" ? copy.submitConfirmed : copy.submitRequest}
        </Button>
        <button
          type="button"
          onClick={onChange}
          className="min-h-11 text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
        >
          {copy.change}
        </button>
      </div>

      {/* Doctolib-Alternative nur, wenn die echte Profil-URL konfiguriert ist –
          und nicht im verbindlichen Modus, in dem die Website selbst verbindlich bucht */}
      {mode !== "confirmed" && site.doctolibConfigured && (
        <div className="mt-6 flex flex-col gap-2 border-t border-ink/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/65">{copy.doctolibAlt}</p>
          <a
            href={site.doctolibUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {copy.doctolibCta}
            <Icon name="arrow-right" size={15} />
          </a>
        </div>
      )}
    </div>
  );
}
