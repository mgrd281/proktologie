import { Icon } from "@/components/ui/Icon";
import { bookingCopy } from "@/content/booking";
import { site } from "@/content/site";

/**
 * Ehrlicher Ladefehler der Buchung: Was gescheitert ist, „Erneut
 * versuchen“ und das Telefon als sicherer zweiter Weg. Früher stand dann
 * ein ganz grauer Monat da – wie ausgebucht.
 */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-mist/70 px-4 py-3 text-sm leading-relaxed text-ink">
      <p>{bookingCopy.loadError}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center font-medium text-primary-deep underline underline-offset-4 hover:text-primary"
        >
          {bookingCopy.retry}
        </button>
        <a href={site.phoneHref} className="inline-flex min-h-11 items-center gap-2 font-medium text-ink hover:text-primary-deep">
          <Icon name="phone" size={16} className="text-primary-deep" />
          {site.phone}
        </a>
      </div>
    </div>
  );
}
