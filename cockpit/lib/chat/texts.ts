import { PRACTICE } from "../practice.ts";
import type { Lang } from "./language.ts";

/**
 * Alles, was der Assistent sagen kann – zweisprachig, an einer Stelle.
 *
 * Warum eine eigene Datei: Diese Sätze sind das Versprechen der Praxis an
 * ihre Patientinnen und Patienten. Sie sollen nachlesbar und änderbar sein,
 * ohne den Gesprächsablauf zu lesen. Der Notfallsatz, die Ablehnung
 * medizinischer Fragen und der Datenschutzhinweis sind wörtlich so
 * vorgegeben und dürfen nicht „schöner“ formuliert werden.
 *
 * Das Sprachmodell schreibt hier nichts hinein. Es darf höchstens eine
 * Antwort aus gepflegten Fakten umformulieren (knowledge.ts) – alle Sätze
 * dieser Datei kommen ohne Modell zustande und stehen deshalb auch dann
 * zur Verfügung, wenn kein Anbieter erreichbar ist.
 */

const P = PRACTICE.phone;

export interface Texts {
  emergency: string;
  medicalRefusal: string;
  healthHint: string;
  /** Kurzform ohne Terminfrage – wenn der Ablauf ohnehin weitergeht. */
  healthHintShort: string;
  /** Akut, aber kein Notfall: kurzfristige Termine, bitte anrufen. */
  acute: string;

  askType: string;
  /** Vor der Terminart, wenn sie aus freiem Text erkannt wurde: „Notiert: Hämorrhoiden.“ */
  typeNoted: string;
  askDate: string;
  askTime: string;
  askContact: string;
  confirmQuestion: string;
  confirmAgain: string;
  changed: string;
  /** Am Wochenende ist zu – gefragt wird trotzdem nach einem Werktag. */
  weekendAsk: string;
  /** Antwort auf „gibt es was später?", wenn es nichts Späteres gibt. */
  noLater: string;
  /** Antwort auf „gibt es was früher?", wenn es nichts Früheres gibt. */
  noEarlier: string;
  /** „Ja, aber …“ ohne erkennbare Korrektur. */
  whatToChange: string;
  /** Kontaktdaten sind schon bekannt – Zusammenfassung ohne Formular. */
  contactReused: string;

  bookedMailSent: string;
  bookedMailFailed: string;
  bookNotPossible: string;
  dailyLimit: string;
  blocked: string;

  callbackIntro: string;
  callbackSaved: string;
  callbackFailed: string;

  handover: string;
  forward: string;
  unknownTopic: string;
  notUnderstood: string;
  llmDown: string;
  rateLimited: string;
  disabled: string;

  quick: Record<
    | "book"
    | "hours"
    | "directions"
    | "yes"
    | "no"
    | "callback"
    | "nextfree"
    | "other"
    | "again"
    | "myAppointment"
    | "changeDate"
    | "changeTime"
    | "changeType"
    | "changeContact"
    | "takeIt"
    | "later"
    | "earlier",
    string
  >;
  form: {
    contactTitle: string;
    callbackTitle: string;
    firstName: string;
    lastName: string;
    email: string;
    emailOptional: string;
    phone: string;
    phoneOptional: string;
    consent: string;
    note: string;
    preferredTime: string;
    preferred: Record<"egal" | "vormittags" | "nachmittags", string>;
    kind: string;
    kinds: Record<"rueckruf" | "folgerezept" | "ueberweisung" | "befundkopie" | "sonstiges", string>;
    submitContact: string;
    submitCallback: string;
  };
  errors: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    consent: string;
  };
}

const de: Texts = {
  emergency:
    `Das klingt nach einem Notfall. Bitte rufen Sie sofort den Notruf 112 an. ` +
    `Bei dringenden, nicht lebensbedrohlichen Beschwerden: ärztlicher Bereitschaftsdienst 116 117. ` +
    `Dieser Chat kann keine Notfallhilfe leisten.`,
  // Wörtlich vorgegeben – der Arzt ist Dr. med. Kai Kunstreich.
  medicalRefusal: "Dazu kann ich nichts sagen, das bespricht Dr. Kunstreich mit Ihnen persönlich. Soll ich Ihnen einen Termin suchen?",
  healthHint:
    "Bitte schreiben Sie hier keine gesundheitlichen Details – die besprechen Sie vertraulich in der Praxis. Ihre Nachricht habe ich nicht weitergegeben. Soll ich Ihnen einen Termin suchen?",
  healthHintShort:
    "Bitte schreiben Sie hier keine gesundheitlichen Details – die besprechen Sie vertraulich in der Praxis. Ihre Nachricht habe ich nicht weitergegeben.",
  acute: `Bei akuten Beschwerden rufen Sie bitte zuerst an: ${P} – die Praxis hält kurzfristige Termine bereit.`,

  askType: "Gern. Worum geht es bei dem Termin?",
  typeNoted: "Notiert:",
  askDate: "Für welchen Tag darf ich nachsehen?",
  askTime: "Welche Uhrzeit passt Ihnen?",
  askContact: "Bitte tragen Sie noch Ihre Kontaktdaten ein – ohne gesundheitliche Angaben.",
  confirmQuestion: "Soll ich das so verbindlich buchen?",
  confirmAgain: "Ich möchte sichergehen: Soll ich den Termin verbindlich buchen? Bitte antworten Sie mit Ja oder Nein.",
  changed: "Kein Problem. Für welchen Tag darf ich nachsehen?",
  weekendAsk: "Passt Ihnen stattdessen ein Freitag oder ein Montag?",
  noLater: "Später ist an dem Tag nichts mehr frei.",
  noEarlier: "Früher ist an dem Tag nichts mehr frei.",
  whatToChange: "Gern – was möchten Sie ändern?",
  contactReused: "Ihre Kontaktdaten habe ich noch.",

  bookedMailSent: "Die Bestätigung mit Kalendereintrag und Absage-Link ist per E-Mail unterwegs.",
  bookedMailFailed: `Die Bestätigungs-E-Mail konnte gerade nicht verschickt werden; wir versuchen es automatisch erneut. Bei Fragen: ${P}.`,
  bookNotPossible: `Die Buchung hat gerade nicht geklappt. Bitte rufen Sie uns an: ${P}.`,
  dailyLimit: `Über den Chat kann ich für diese E-Mail-Adresse heute keinen weiteren Termin buchen. Bitte rufen Sie uns an: ${P}.`,
  blocked: `Diesen Wunsch kann ich im Chat nicht bearbeiten. Bitte rufen Sie uns an: ${P}.`,

  callbackIntro: "Gern notiere ich einen Rückruf. Bitte tragen Sie Ihren Namen und Ihre Telefonnummer ein – ohne gesundheitliche Angaben.",
  callbackSaved: "Notiert. Die Praxis meldet sich bei Ihnen.",
  callbackFailed: `Die Notiz hat gerade nicht geklappt. Bitte rufen Sie uns an: ${P}.`,

  handover: `Gern verbinde ich Sie mit dem Team: Telefon ${P}. Oder soll ich einen Rückruf notieren?`,
  forward: `Rezepte, Krankschreibungen, Befunde und Überweisungen kann ich im Chat nicht klären. Ich leite Ihr Anliegen gern an die Praxis weiter – oder rufen Sie an: ${P}.`,
  unknownTopic: `Das weiß ich leider nicht. Rufen Sie uns gern an: ${P} – oder ich notiere einen Rückruf.`,
  notUnderstood: "Das habe ich nicht verstanden. Möchten Sie einen Termin vereinbaren, die Öffnungszeiten oder die Anfahrt wissen?",
  llmDown: `Das kann ich gerade nicht beantworten. Rufen Sie uns bitte an: ${P} – oder nutzen Sie die Schaltflächen unten.`,
  rateLimited: `Für heute ist hier Schluss – bitte rufen Sie uns an: ${P}.`,
  disabled: `Der Chat ist im Moment nicht verfügbar. Sie erreichen uns telefonisch: ${P}.`,

  quick: {
    book: "Termin vereinbaren",
    hours: "Öffnungszeiten",
    directions: "Anfahrt",
    yes: "Ja, verbindlich buchen",
    no: "Nein, ändern",
    callback: "Rückruf notieren",
    nextfree: "Nächster freier Termin",
    other: "Andere Uhrzeit",
    again: "Noch ein Termin",
    myAppointment: "Mein Termin",
    changeDate: "Anderer Tag",
    changeTime: "Andere Uhrzeit",
    changeType: "Andere Terminart",
    changeContact: "Andere Kontaktdaten",
    takeIt: "Ja, diesen nehmen",
    later: "Spätere Zeiten",
    earlier: "Frühere Zeiten",
  },
  form: {
    contactTitle: "Ihre Kontaktdaten",
    callbackTitle: "Rückruf",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    emailOptional: "E-Mail (optional)",
    phone: "Telefon",
    phoneOptional: "Telefon (optional)",
    consent: "Ich bin einverstanden, dass meine Angaben zur Terminvergabe gespeichert werden.",
    note: "Nachricht (keine Gesundheitsdaten)",
    preferredTime: "Wann sollen wir anrufen?",
    preferred: { egal: "Egal", vormittags: "Vormittags", nachmittags: "Nachmittags" },
    kind: "Anliegen",
    kinds: {
      rueckruf: "Rückruf",
      folgerezept: "Folgerezept",
      ueberweisung: "Überweisung",
      befundkopie: "Befundkopie",
      sonstiges: "Sonstiges",
    },
    submitContact: "Weiter",
    submitCallback: "Rückruf anfordern",
  },
  errors: {
    firstName: "Bitte tragen Sie Ihren Vornamen ein.",
    lastName: "Bitte tragen Sie Ihren Nachnamen ein.",
    email: "Bitte prüfen Sie die E-Mail-Adresse.",
    phone: "Bitte tragen Sie eine Telefonnummer ein.",
    consent: "Ohne Ihre Einwilligung kann ich den Termin nicht buchen.",
  },
};

const en: Texts = {
  emergency:
    "This sounds like an emergency. Please call the emergency number 112 immediately. " +
    "For urgent but not life-threatening problems: the out-of-hours medical service on 116 117. " +
    "This chat cannot provide emergency help.",
  medicalRefusal: "I cannot say anything about that; Dr. Kunstreich will discuss it with you in person. Shall I look for an appointment for you?",
  healthHint:
    "Please do not write any health details here – you can discuss those confidentially at the practice. I have not passed your message on. Shall I look for an appointment for you?",
  healthHintShort:
    "Please do not write any health details here – you can discuss those confidentially at the practice. I have not passed your message on.",
  acute: `For acute problems please call us first: ${P} – the practice keeps short-notice appointments available.`,

  askType: "Certainly. What is the appointment about?",
  typeNoted: "Noted:",
  askDate: "Which day shall I check?",
  askTime: "Which time suits you?",
  askContact: "Please add your contact details – without any health information.",
  confirmQuestion: "Shall I book this bindingly?",
  confirmAgain: "Just to be sure: shall I book the appointment bindingly? Please answer yes or no.",
  changed: "No problem. Which day shall I check?",
  weekendAsk: "Would a Friday or a Monday work instead?",
  noLater: "There is nothing later available that day.",
  noEarlier: "There is nothing earlier available that day.",
  whatToChange: "Certainly – what would you like to change?",
  contactReused: "I still have your contact details.",

  bookedMailSent: "The confirmation with a calendar entry and a cancellation link is on its way by e-mail.",
  bookedMailFailed: `The confirmation e-mail could not be sent just now; we will retry automatically. If you have questions: ${P}.`,
  bookNotPossible: `The booking did not go through just now. Please call us: ${P}.`,
  dailyLimit: `I cannot book another appointment for this e-mail address in the chat today. Please call us: ${P}.`,
  blocked: `I cannot handle this request in the chat. Please call us: ${P}.`,

  callbackIntro: "I will gladly note a callback. Please enter your name and phone number – without any health information.",
  callbackSaved: "Noted. The practice will get back to you.",
  callbackFailed: `The note did not go through just now. Please call us: ${P}.`,

  handover: `I will gladly put you through to the team: phone ${P}. Or shall I note a callback?`,
  forward: `I cannot handle prescriptions, sick notes, findings or referrals in the chat. I will gladly pass your request on to the practice – or call us: ${P}.`,
  unknownTopic: `I am afraid I do not know that. Please call us: ${P} – or I can note a callback.`,
  notUnderstood: "I did not understand that. Would you like to book an appointment, or know our opening hours or how to get here?",
  llmDown: `I cannot answer that right now. Please call us: ${P} – or use the buttons below.`,
  rateLimited: `That is all for today here – please call us: ${P}.`,
  disabled: `The chat is not available at the moment. You can reach us by phone: ${P}.`,

  quick: {
    book: "Book an appointment",
    hours: "Opening hours",
    directions: "Getting here",
    yes: "Yes, book it",
    no: "No, change it",
    callback: "Request a callback",
    nextfree: "Next available appointment",
    other: "Another time",
    again: "Another appointment",
    myAppointment: "My appointment",
    changeDate: "Another day",
    changeTime: "Another time",
    changeType: "Another type",
    changeContact: "Other contact details",
    takeIt: "Yes, take that one",
    later: "Later times",
    earlier: "Earlier times",
  },
  form: {
    contactTitle: "Your contact details",
    callbackTitle: "Callback",
    firstName: "First name",
    lastName: "Last name",
    email: "E-mail",
    emailOptional: "E-mail (optional)",
    phone: "Phone",
    phoneOptional: "Phone (optional)",
    consent: "I agree that my details may be stored for the purpose of arranging an appointment.",
    note: "Message (no health data)",
    preferredTime: "When should we call?",
    preferred: { egal: "Any time", vormittags: "Morning", nachmittags: "Afternoon" },
    kind: "Request",
    kinds: {
      rueckruf: "Callback",
      folgerezept: "Repeat prescription",
      ueberweisung: "Referral",
      befundkopie: "Copy of findings",
      sonstiges: "Other",
    },
    submitContact: "Continue",
    submitCallback: "Request callback",
  },
  errors: {
    firstName: "Please enter your first name.",
    lastName: "Please enter your last name.",
    email: "Please check the e-mail address.",
    phone: "Please enter a phone number.",
    consent: "Without your consent I cannot book the appointment.",
  },
};

export const TEXTS: Record<Lang, Texts> = { de, en };

export function t(lang: Lang): Texts {
  return TEXTS[lang];
}
