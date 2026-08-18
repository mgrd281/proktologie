/** „Zum Inhalt springen" – erstes fokussierbares Element der Seite. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-full focus:bg-primary focus:px-6 focus:py-3 focus:text-sm focus:font-medium focus:text-white"
    >
      Zum Inhalt springen
    </a>
  );
}
