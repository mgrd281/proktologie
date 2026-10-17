/**
 * Wischreihe für das Handy: Statt acht Karten untereinander (acht
 * Bildschirme Daumenarbeit) steht eine Reihe, die man seitlich wischt –
 * die nächste Karte lugt am Rand hervor und sagt ohne Worte, dass es
 * weitergeht. Das Wischen ist reines CSS (Scroll-Snap); Zähler, Pfeile
 * und Fokus liefert components/ui/SwipeRow.tsx.
 *
 * Alle Klassen tragen `max-md:` – ab 768 px greift ausschließlich das
 * Layout, das die Sektion selbst angibt. Desktop und Tablet bleiben
 * damit pixelgleich.
 */
export const swipeList =
  "max-md:-mx-5 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:gap-4 max-md:overflow-x-auto max-md:scroll-px-5 max-md:px-5 max-md:pb-3 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden max-md:focus-visible:outline-2 max-md:focus-visible:outline-offset-4 max-md:focus-visible:outline-primary";

export const swipeItem = "max-md:w-[84%] max-md:max-w-80 max-md:shrink-0 max-md:snap-start";
