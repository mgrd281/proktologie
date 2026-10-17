/**
 * Notfallnummern für die Zeit außerhalb der Sprechzeiten – bundesweit gültig
 * und kostenfrei. Eine Quelle für Kontakt, Footer, FAQ und Chat.
 */
export const notfall = {
  lead: "Außerhalb der Sprechzeiten:",
  duty: { label: "Ärztlicher Bereitschaftsdienst", number: "116 117", href: "tel:116117" },
  emergency: { label: "Notruf", number: "112", href: "tel:112" },
} as const;

/** Als ein Satz, z. B. für den Chat: „Außerhalb der Sprechzeiten: Ärztlicher Bereitschaftsdienst 116 117 · Notruf 112“. */
export const notfallLine = `${notfall.lead} ${notfall.duty.label} ${notfall.duty.number} · ${notfall.emergency.label} ${notfall.emergency.number}`;
