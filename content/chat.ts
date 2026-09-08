import { site } from "@/content/site";

/**
 * Alle Texte des Chat-Fensters – zweisprachig, an einer Stelle.
 *
 * Die Begrüßung, der Datenschutzhinweis und das Offline-Panel entstehen
 * hier im Browser, ohne Serveraufruf. Alles andere, was der Assistent
 * sagt, kommt aus dem Cockpit: Diese Datei erfindet keine Antworten und
 * hält bewusst keine Sprechzeiten doppelt vor, sondern nimmt sie aus
 * `site.hours` – derselben Quelle wie Kontaktseite und Footer.
 */

export type ChatLang = "de" | "en";

/** Sprechzeiten in einer Zeile: „Mo, Mi, Fr 07:00 – 12:00 Uhr · …“ */
export function hoursLine(lang: ChatLang): string {
  const map: Record<string, string> = {
    "Montag, Mittwoch, Freitag": lang === "de" ? "Mo, Mi, Fr" : "Mon, Wed, Fri",
    "Dienstag, Donnerstag": lang === "de" ? "Di, Do" : "Tue, Thu",
  };
  return site.hours
    .filter((h) => map[h.days])
    .map((h) => `${map[h.days]} ${lang === "de" ? h.time : h.time.replace(" Uhr", "").replace(" und ", " and ")}`)
    .join(" · ");
}

export interface ChatCopy {
  launcherOpen: string;
  launcherClose: string;
  windowTitle: string;
  windowSubtitle: string;
  close: string;
  langSwitch: string;
  logLabel: string;
  composerLabel: string;
  composerPlaceholder: string;
  /** Beschriftungen des Mikrofons. */
  voice: {
    start: string;
    stop: string;
    connecting: string;
    listening: string;
    hearing: string;
    answering: string;
    denied: string;
    error: string;
    hint: string;
  };
  send: string;
  typing: string;
  greeting: (hours: string) => string;
  privacyNote: string;
  privacyLink: string;
  privacyHref: string;
  quickStart: Array<{ id: string; label: string }>;
  emergencyTitle: string;
  offlineTitle: string;
  offline: (hours: string) => string;
  callLabel: string;
  errors: {
    network: string;
    rate_limited: string;
    chat_disabled: string;
    invalid: string;
  };
  submit: string;
  required: string;
  restart: string;
}

const de: ChatCopy = {
  launcherOpen: "Chat öffnen",
  launcherClose: "Chat schließen",
  windowTitle: site.name,
  windowSubtitle: "Termine und Fragen",
  close: "Schließen",
  langSwitch: "English",
  logLabel: "Gesprächsverlauf",
  composerLabel: "Ihre Nachricht",
  composerPlaceholder: "Frage oder Terminwunsch schreiben …",
  voice: {
    start: "Sprechen",
    stop: "Zuhören beenden",
    connecting: "Einen Moment, ich schalte das Mikrofon ein …",
    listening: "Ich höre zu. Sprechen Sie einfach.",
    hearing: "Ich höre Sie …",
    answering: "Einen Moment …",
    denied: "Ohne Mikrofon-Erlaubnis kann ich nicht zuhören. Schreiben geht weiterhin.",
    error: "Das Zuhören hat nicht geklappt. Bitte schreiben Sie mir – oder rufen Sie an.",
    hint: "Bitte keine gesundheitlichen Angaben sprechen. Das Gesprochene wird zum Erkennen an unseren Sprachanbieter übertragen und nicht gespeichert.",
  },
  send: "Senden",
  typing: "Der Assistent schreibt …",
  greeting: (hours) =>
    `Guten Tag, hier ist der Assistent der ${site.name} (${site.doctor}). Sprechzeiten: ${hours}. Wie kann ich helfen?`,
  privacyNote:
    "Hinweis: Bitte keine Gesundheitsdaten in den Chat schreiben. Der Verlauf bleibt nur in Ihrem Browser, bis Sie den Tab schließen.",
  privacyLink: "Datenschutzerklärung",
  privacyHref: "/datenschutz/#chat",
  quickStart: [
    { id: "book", label: "Termin vereinbaren" },
    { id: "hours", label: "Öffnungszeiten" },
    { id: "directions", label: "Anfahrt" },
  ],
  emergencyTitle: "Notfall",
  offlineTitle: "Chat gerade nicht verfügbar",
  offline: (hours) => `Sie erreichen uns telefonisch unter ${site.phone}. Sprechzeiten: ${hours}.`,
  callLabel: `Anrufen: ${site.phone}`,
  errors: {
    network: `Die Verbindung hat nicht geklappt. Bitte versuchen Sie es noch einmal – oder rufen Sie an: ${site.phone}.`,
    rate_limited: `Für heute ist hier Schluss. Bitte rufen Sie uns an: ${site.phone}.`,
    chat_disabled: `Der Chat ist im Moment nicht verfügbar. Sie erreichen uns telefonisch: ${site.phone}.`,
    invalid: `Das hat nicht geklappt. Bitte rufen Sie uns an: ${site.phone}.`,
  },
  submit: "Absenden",
  required: "Pflichtfeld",
  restart: "Neues Gespräch",
};

const en: ChatCopy = {
  launcherOpen: "Open chat",
  launcherClose: "Close chat",
  windowTitle: site.name,
  windowSubtitle: "Appointments and questions",
  close: "Close",
  langSwitch: "Deutsch",
  logLabel: "Conversation",
  composerLabel: "Your message",
  composerPlaceholder: "Ask a question or name a time …",
  voice: {
    start: "Speak",
    stop: "Stop listening",
    connecting: "One moment, turning on the microphone …",
    listening: "I am listening. Just speak.",
    hearing: "I can hear you …",
    answering: "One moment …",
    denied: "Without microphone permission I cannot listen. You can still type.",
    error: "Listening did not work. Please write to me – or give us a call.",
    hint: "Please do not speak any health details. What you say is sent to our speech provider for recognition and is not stored.",
  },
  send: "Send",
  typing: "The assistant is typing …",
  greeting: (hours) =>
    `Hello, this is the assistant of ${site.name} (${site.doctor}). Opening hours: ${hours}. How can I help?`,
  privacyNote:
    "Please do not write any health data in this chat. The conversation stays in your browser only, until you close the tab.",
  privacyLink: "Privacy policy",
  privacyHref: "/datenschutz/#chat",
  quickStart: [
    { id: "book", label: "Book an appointment" },
    { id: "hours", label: "Opening hours" },
    { id: "directions", label: "Getting here" },
  ],
  emergencyTitle: "Emergency",
  offlineTitle: "Chat unavailable",
  offline: (hours) => `You can reach us by phone on ${site.phone}. Opening hours: ${hours}.`,
  callLabel: `Call us: ${site.phone}`,
  errors: {
    network: `The connection failed. Please try again – or call us: ${site.phone}.`,
    rate_limited: `That is all for today here. Please call us: ${site.phone}.`,
    chat_disabled: `The chat is not available at the moment. You can reach us by phone: ${site.phone}.`,
    invalid: `That did not work. Please call us: ${site.phone}.`,
  },
  submit: "Submit",
  required: "Required",
  restart: "New conversation",
};

export const chatCopy: Record<ChatLang, ChatCopy> = { de, en };
