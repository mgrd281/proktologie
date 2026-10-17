/**
 * Rücksprung nach der Anmeldung („weiter“): nur Pfade dieser App.
 * „//fremd.example“ oder „/\fremd.example“ beginnen zwar mit „/“, führen den
 * Browser aber auf eine fremde Adresse – die landen auf der Startseite.
 * Ohne Abhängigkeiten, damit Server- und Browser-Code ihn teilen.
 */
export function safeNext(weiter: string | null | undefined): string {
  if (!weiter || !weiter.startsWith("/") || weiter.startsWith("//") || weiter.startsWith("/\\")) return "/";
  return weiter;
}

/**
 * Die volle Adresse für „weiter“: Pfad samt Abfrage (Tag, Ansicht, geöffneter
 * Termin), ohne den internen Parameter, mit dem Next Seitenwechsel lädt.
 */
export function returnPath(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete("_rsc");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Request-Header, über den der Proxy (proxy.ts) den Seiten ihre volle Adresse mitgibt. */
export const RETURN_HEADER = "x-cockpit-weiter";

/** Antwort einer Aktion, die eine frische Anmeldung braucht (lib/auth/actor.ts). */
export const STALE_MESSAGE = "Bitte erneut anmelden, um diese Aktion auszuführen.";

/** Ziel von „Jetzt neu anmelden“: Anmeldung mit Hinweis, danach zurück an dieselbe Stelle. */
export function freshLoginHref(weiter: string): string {
  const back = safeNext(weiter);
  return back === "/" ? "/login?grund=frisch" : `/login?grund=frisch&weiter=${encodeURIComponent(back)}`;
}
