import { Icon } from "@/components/ui/Icon";
import { appointmentTypes, bookingCopy, bookingDialog } from "@/content/booking";
import { site } from "@/content/site";
import type { BookingDraft, BookingProviderMode } from "@/lib/booking/types";

/**
 * Schritt 5: Übersicht vor dem Abschicken. Jede Angabe lässt sich mit
 * „Ändern“ im passenden Schritt korrigieren – alles andere bleibt stehen.
 * Der Absende-Knopf steht im Fuß des Dialogs: im „request“-Modus ehrlich
 * „Terminanfrage senden“, erst mit mode="confirmed" „Termin verbindlich buchen“.
 * Daneben (nur im Anfrage-Modus) der offizielle Doctolib-Weg.
 */

interface StepConfirmProps {
  draft: BookingDraft;
  mode: BookingProviderMode;
  /** Zum Schritt springen (0 Terminart, 1 Tag, 2 Uhrzeit, 3 Angaben) */
  onEdit: (step: number) => void;
  /** Während gebucht wird, ändert niemand etwas */
  locked: boolean;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

interface Row {
  label: string;
  value: string;
  /** Schritt für „Ändern“ – fehlt bei festen Angaben (Praxis, Behandler) */
  step?: number;
}

function Rows({ rows, onEdit, locked }: { rows: Row[]; onEdit: (step: number) => void; locked: boolean }) {
  return (
    <dl className="divide-y divide-ink/8 rounded-2xl bg-mist/70 px-4 md:px-5">
      {rows.map((row) => (
        // dt/dd direkt in der Zeile (gültige Beschreibungsliste); „Ändern“ als zweites dd
        <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2.5">
          <dt className="col-start-1 text-xs font-medium tracking-wide text-ink/70 uppercase">{row.label}</dt>
          <dd className="col-start-1 mt-0.5 text-sm font-medium break-words text-ink">{row.value}</dd>
          {row.step !== undefined && (
            <dd className="col-start-2 row-span-2 row-start-1">
              <button
                type="button"
                onClick={() => !locked && onEdit(row.step!)}
                aria-disabled={locked || undefined}
                // „Uhrzeit ändern“ – der sichtbare Text steckt im Namen (WCAG 2.5.3)
                aria-label={`${row.label} ${bookingDialog.change.toLowerCase()}`}
                className="-mr-2 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-primary-deep underline-offset-4 hover:underline focus-visible:rounded-full! aria-disabled:cursor-progress aria-disabled:opacity-50"
              >
                {bookingDialog.change}
              </button>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

export function StepConfirm({ draft, mode, onEdit, locked }: StepConfirmProps) {
  const copy = bookingCopy.confirm;
  const type = appointmentTypes.find((t) => t.id === draft.typeId);
  const [y, m, d] = (draft.date ?? "").split("-").map(Number);
  const dateLabel = draft.date ? dateFormat.format(new Date(y, m - 1, d)) : "–";

  const appointment: Row[] = [
    { label: "Terminart", value: type?.label ?? "–", step: 0 },
    { label: "Datum", value: dateLabel, step: 1 },
    { label: "Uhrzeit", value: draft.time ? `${draft.time} Uhr` : "–", step: 2 },
  ];
  const details: Row[] = [
    { label: bookingDialog.name, value: `${draft.firstName} ${draft.lastName}`.trim() || "–", step: 3 },
    { label: bookingDialog.email, value: draft.email.trim() || "–", step: 3 },
    { label: bookingDialog.phone, value: draft.phone.trim() || "–", step: 3 },
  ];

  return (
    <div className="space-y-5">
      <section aria-label={bookingDialog.appointment}>
        <Rows rows={appointment} onEdit={onEdit} locked={locked} />
      </section>

      <section aria-labelledby="booking-confirm-details">
        <h4 id="booking-confirm-details" className="mb-2 text-sm font-medium text-ink">
          {bookingDialog.yourDetails}
        </h4>
        <Rows rows={details} onEdit={onEdit} locked={locked} />
      </section>

      <p className="flex items-start gap-3 text-sm leading-relaxed text-ink/75">
        <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-primary-deep" />
        <span>
          {site.name} · {site.doctor}
          <br />
          {site.address.street}, {site.address.zip} {site.address.city}
        </span>
      </p>

      <p className="text-xs leading-relaxed text-ink/70">
        {mode === "confirmed" ? copy.confirmedHint : copy.requestHint}
      </p>

      {/* Doctolib-Alternative nur, wenn die echte Profil-URL konfiguriert ist –
          und nicht im verbindlichen Modus, in dem die Website selbst verbindlich bucht */}
      {mode !== "confirmed" && site.doctolibConfigured && (
        <div className="flex flex-col gap-2 border-t border-ink/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/70">{copy.doctolibAlt}</p>
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
