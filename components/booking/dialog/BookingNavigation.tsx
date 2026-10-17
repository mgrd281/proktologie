import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface BookingNavigationProps {
  /** „Zurück“ zeigen (ab Schritt 2) */
  canGoBack: boolean;
  backLabel: string;
  onBack: () => void;
  /** Beschriftung der Hauptaktion: „Weiter“, „Termin verbindlich buchen“, „Schließen“ */
  primaryLabel: string;
  /** Kann es weitergehen? Sonst bleibt der Knopf fokussierbar und sagt, was fehlt. */
  ready: boolean;
  onPrimary?: () => void;
  /** Absenden eines Formulars im Inhalt (Schritt „Angaben“) */
  formId?: string;
  loading?: boolean;
  loadingLabel?: string;
  withArrow?: boolean;
  /** Hinweis neben dem Knopf – etwa „Bitte wählen Sie einen Tag.“ */
  hint?: ReactNode;
}

/**
 * Klebender Fuß des Termin-Sheets: ein ruhiges „Zurück“ links, die eine grüne
 * Hauptaktion rechts (Handy: über die restliche Breite). Liegt über dem
 * Sicherheitsabstand unten (Home-Leiste); eine Trennlinie erscheint nur,
 * solange darüber noch Inhalt folgt (`data-more` am Sheet).
 *
 * Fehlt im Schritt noch eine Wahl, ist „Weiter“ nicht gesperrt, sondern
 * erklärt beim Antippen, was fehlt (aria-disabled statt disabled: Der Fokus
 * bleibt, und Screenreader hören den Grund).
 *
 * Beim Absenden steht „Wird gebucht …“ direkt im Knopf – ohne das
 * Breiten-Gitter des Buttons, das beide Texte nebeneinander vermisst und auf
 * 360 px Breite zwei Zeilen erzwänge. Am Desktop hält eine Mindestbreite den
 * Knopf beim Wechsel ruhig.
 */
export function BookingNavigation({
  canGoBack,
  backLabel,
  onBack,
  primaryLabel,
  ready,
  onPrimary,
  formId,
  loading = false,
  loadingLabel,
  withArrow = true,
  hint,
}: BookingNavigationProps) {
  return (
    <div className="shrink-0 border-t border-transparent bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-colors duration-200 group-data-[more]/sheet:border-ink/8 md:px-8 md:py-4">
      <p role="status" className={cn("flex items-start gap-2 text-sm leading-snug text-ink/75", hint ? "mb-3" : "sr-only")}>
        {hint && <Icon name="info" size={16} className="mt-0.5 shrink-0 text-primary-deep" />}
        <span>{hint}</span>
      </p>
      <div className="flex items-center gap-2 md:gap-3">
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            aria-disabled={loading || undefined}
            className="-ml-2.5 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full pr-3 pl-2 text-sm font-medium text-ink/75 transition-colors duration-200 hover:text-ink active:bg-ink/5 focus-visible:rounded-full! aria-disabled:cursor-progress aria-disabled:opacity-50"
          >
            <Icon name="chevron-left" size={20} />
            {backLabel}
          </button>
        )}
        {/* Eigener Knopf je Art: Würde derselbe Knopf im Klick (Schritt 3 → 4) zum
            Absende-Knopf, schickte der Browser das neue Formular gleich mit ab. */}
        <Button
          key={formId ? "submit" : "button"}
          type={formId ? "submit" : "button"}
          form={formId}
          onClick={onPrimary}
          withArrow={withArrow}
          loading={loading}
          aria-disabled={!ready || undefined}
          className={cn(
            "flex-1 max-md:px-4! md:ml-auto md:flex-none",
            loadingLabel && "md:min-w-64",
            !ready && "bg-ink/8! text-ink/60! hover:bg-ink/8! active:bg-ink/8!",
          )}
        >
          {loading && loadingLabel ? loadingLabel : primaryLabel}
        </Button>
      </div>
    </div>
  );
}
