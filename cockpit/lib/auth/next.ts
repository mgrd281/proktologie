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
