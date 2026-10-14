import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Wischreihe für das Handy: Statt acht Karten untereinander (acht
 * Bildschirme Daumenarbeit) steht eine Reihe, die man seitlich wischt –
 * die nächste Karte lugt am Rand hervor und sagt ohne Worte, dass es
 * weitergeht. Reines CSS (Scroll-Snap), kein JavaScript.
 *
 * Alle Klassen tragen `max-md:` – ab 768 px greift ausschließlich das
 * Layout, das die Sektion selbst angibt. Desktop und Tablet bleiben
 * damit pixelgleich.
 */
export const swipeList =
  "max-md:-mx-5 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:gap-4 max-md:overflow-x-auto max-md:scroll-px-5 max-md:px-5 max-md:pb-3 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden max-md:focus-visible:outline-2 max-md:focus-visible:outline-offset-4 max-md:focus-visible:outline-primary";

export const swipeItem = "max-md:w-[84%] max-md:max-w-80 max-md:shrink-0 max-md:snap-start";

/** Kleiner Hinweis unter der Reihe – nur auf dem Handy. */
export function SwipeHint({ onDark = false }: { onDark?: boolean }) {
  return (
    <p
      aria-hidden="true"
      className={cn(
        "mt-3 flex items-center gap-2 text-xs tracking-wide md:hidden",
        onDark ? "text-cream/70" : "text-ink/70",
      )}
    >
      Zum Weiterlesen seitlich wischen
      <Icon name="arrow-right" size={14} />
    </p>
  );
}
