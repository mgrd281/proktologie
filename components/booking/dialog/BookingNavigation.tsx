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
 * Klebender Fuß des Termin-Dialogs: „Zurück“ links, die eine grüne
 * Hauptaktion rechts (Handy: über die volle Breite). Auf dem Handy liegt er
 * über dem Sicherheitsabstand unten (Home-Leiste).
 *
 * Fehlt im Schritt noch eine Wahl, ist „Weiter“ nicht gesperrt, sondern
 * erklärt beim Antippen, was fehlt (aria-disabled statt disabled: Der Fokus
 * bleibt, und Screenreader hören den Grund).
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
    <div className="shrink-0 border-t border-ink/8 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8 md:py-4">
      <p role="status" className={cn("flex items-start gap-2 text-sm leading-snug text-ink/75", hint ? "mb-3" : "sr-only")}>
        {hint && <Icon name="info" size={16} className="mt-0.5 shrink-0 text-primary-deep" />}
        <span>{hint}</span>
      </p>
      <div className="flex items-center gap-3">
        {canGoBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            aria-disabled={loading || undefined}
            className="shrink-0 px-4! md:px-5! aria-disabled:cursor-progress aria-disabled:opacity-50"
          >
            <Icon name="arrow-right" size={16} className="rotate-180" />
            {backLabel}
          </Button>
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
          loadingLabel={loadingLabel}
          aria-disabled={!ready || undefined}
          className={cn(
            "flex-1 max-md:px-5! md:ml-auto md:flex-none",
            !ready && "bg-ink/8! text-ink/60! hover:bg-ink/8! active:bg-ink/8!",
          )}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
