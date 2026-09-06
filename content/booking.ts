/**
 * Gesamte deutsche Copy der Terminbuchung – eine Quelle für UI und Provider.
 * Terminarten ohne medizinische Zusatzannahmen; die neutrale Option
 * „Beschwerden / unklar" steht bewusst an erster Stelle (Datensparsamkeit:
 * niemand muss eine Diagnose angeben, um einen Termin anzufragen).
 */

import type { AppointmentType } from "@/lib/booking/types";

export const appointmentTypes: AppointmentType[] = [
  { id: "unklar", label: "Beschwerden / unklar", note: "Wir klären das gemeinsam" },
  { id: "erstuntersuchung", label: "Proktologische Erstuntersuchung" },
  { id: "kontrolle", label: "Kontrolltermin" },
  { id: "haemorrhoiden", label: "Hämorrhoiden" },
  { id: "analfissur", label: "Analfissur" },
  { id: "analfistel", label: "Analfistel" },
  { id: "nachsorge", label: "Nachsorge" },
];

export const bookingSteps = [
  { id: "type", short: "Terminart", title: "Welche Art von Termin benötigen Sie?" },
  { id: "date", short: "Datum", title: "Wählen Sie Ihren Wunschtag" },
  { id: "time", short: "Uhrzeit", title: "Wählen Sie Ihre Wunschzeit" },
  { id: "details", short: "Angaben", title: "Ihre Kontaktdaten" },
  { id: "confirm", short: "Bestätigung", title: "Ihr Termin im Überblick" },
] as const;

export const bookingCopy = {
  cardTitle: "Online-Terminanfrage",
  /** Titel im verbindlichen Modus (Provider „cockpit“). */
  cardTitleConfirmed: "Online-Terminbuchung",
  /**
   * Ehrlichkeits-Hinweis des Wunschtermin-Modus – die Praxis bestätigt;
   * es wird keine Live-Verfügbarkeit behauptet.
   */
  requestModeNote:
    "Sie wählen einen Wunschtermin innerhalb unserer Sprechzeiten – die Praxis bestätigt Ihren Termin persönlich.",
  /** Verbindlicher Modus: echte freie Zeiten aus dem Praxis-Cockpit. */
  confirmedModeNote:
    "Sie sehen echte freie Zeiten und buchen verbindlich – die Bestätigung mit Kalendereintrag kommt sofort per E-Mail.",
  back: "Zurück",
  /** Dezenter Hinweis in der Kartenfußzeile – ab Schritt 1 sichtbar. */
  doctolibHint: "Lieber sofort verbindlich buchen?",
  weekdaysShort: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  months: [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ],
  prevMonth: "Vorheriger Monat",
  nextMonth: "Nächster Monat",
  today: "Heute",
  slotsFor: "Wunschzeiten am",
  slotsForConfirmed: "Freie Zeiten am",
  noSlots:
    "An diesem Tag hat die Praxis keine Sprechzeiten. Bitte wählen Sie einen anderen Tag.",
  noSlotsConfirmed:
    "An diesem Tag ist nichts mehr frei. Bitte wählen Sie einen anderen Tag.",
  slotUnavailable: "nicht verfügbar",
  details: {
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail-Adresse",
    phone: "Telefonnummer",
    privacyNote:
      "Wir verwenden Ihre Angaben ausschließlich zur Terminvereinbarung. Bitte übermitteln Sie hier keine medizinischen Details – alles Weitere besprechen wir vertraulich in der Praxis.",
    /* Einwilligung: Der Link ersetzt die Erwähnung im Satz (kein doppelter,
       nachgestellter Link): „Ich habe die [Datenschutzerklärung] zur Kenntnis …" */
    consentPrefix: "Ich habe die",
    consentLinkLabel: "Datenschutzerklärung",
    consentSuffix:
      "zur Kenntnis genommen und bin mit der Verarbeitung meiner Angaben (einschließlich der gewählten Terminart) zur Terminvereinbarung einverstanden.",
    continue: "Weiter zur Übersicht",
  },
  confirm: {
    heading: "Termin ausgewählt",
    practice: "Praxis",
    doctor: "Behandler",
    submitRequest: "Terminanfrage senden",
    submitConfirmed: "Termin verbindlich buchen",
    change: "Termin ändern",
    requestHint:
      "Die Praxis prüft Ihren Wunschtermin und meldet sich zeitnah mit einer Bestätigung – telefonisch oder per E-Mail.",
    confirmedHint:
      "Mit dem Klick buchen Sie verbindlich. Sie erhalten sofort eine E-Mail mit Kalendereintrag und einem persönlichen Link, über den Sie den Termin bestätigen, verschieben oder absagen können.",
    successHeadingConfirmed: "Termin verbindlich gebucht",
    successConfirmed:
      "Ihre Bestätigung mit Kalendereintrag ist unterwegs. Über den Link in der E-Mail können Sie den Termin jederzeit verschieben oder absagen – ganz ohne Anruf.",
    refLabel: "Ihre Referenz",
    newBooking: "Weiteren Termin buchen",
    doctolibAlt: "Lieber sofort verbindlich buchen?",
    doctolibCta: "Termin über Doctolib buchen",
    successMailto:
      "Ihr E-Mail-Programm öffnet sich mit der vorbereiteten Terminanfrage. Bitte senden Sie die E-Mail ab, um die Anfrage abzuschließen.",
    successEndpoint:
      "Vielen Dank! Ihre Terminanfrage ist eingegangen – die Praxis meldet sich zeitnah mit einer Bestätigung.",
    /* mailto: Es ist noch nichts übermittelt, erst die E-Mail schließt ab –
       die Überschrift darf keinen Abschluss behaupten. */
    successHeadingMailto: "Terminanfrage vorbereitet",
    successHeading: "Terminanfrage übermittelt",
    newRequest: "Weitere Anfrage stellen",
  },
  errors: {
    firstName: "Bitte geben Sie Ihren Vornamen ein.",
    lastName: "Bitte geben Sie Ihren Nachnamen ein.",
    email: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    phone: "Bitte geben Sie Ihre Telefonnummer ein.",
    consent: "Bitte bestätigen Sie die Datenschutzerklärung.",
    summary: "Bitte prüfen Sie die markierten Felder.",
    send: "Ihre Anfrage konnte nicht übermittelt werden. Bitte versuchen Sie es erneut oder rufen Sie uns an.",
    notLive:
      "Die Online-Buchung ist derzeit nicht verfügbar. Bitte rufen Sie uns an oder nutzen Sie den Doctolib-Weg.",
    cancelUnsupported:
      "Bitte stornieren Sie Termine telefonisch oder per E-Mail bei der Praxis.",
    cancelViaLink:
      "Zum Absagen oder Verschieben nutzen Sie bitte den persönlichen Link aus Ihrer Bestätigungs-E-Mail – oder rufen Sie uns an.",
  },
  mailSubject: "Terminanfrage über die Website",
} as const;

/** Copy der Sektion (linke Spalte). */
export const terminSection = {
  kicker: "Termin",
  title: "Vereinbaren Sie Ihren Termin.",
  text: "Wählen Sie einfach einen passenden Termin. Diskret, unkompliziert und rund um die Uhr.",
  phoneLabel: "Telefonisch",
  doctolibLabel: "Online über Doctolib",
  doctolibNote: "Verbindliche Online-Buchung über die offizielle Doctolib-Seite.",
  locationLabel: "Praxis",
  acuteNote:
    "Bei akuten Beschwerden kontaktieren Sie die Praxis bitte telefonisch.",
  callback: {
    question: "Kein passender Termin dabei?",
    open: "Rückruf anfordern",
    close: "Schließen",
    name: "Ihr Name",
    phone: "Telefonnummer",
    timeLabel: "Bevorzugte Zeit",
    timeOptions: ["Egal", "Vormittags", "Nachmittags"],
    submit: "Rückruf anfordern",
    success:
      "Ihr E-Mail-Programm öffnet sich mit der vorbereiteten Rückrufbitte. Bitte senden Sie die E-Mail ab.",
    errors: {
      name: "Bitte geben Sie Ihren Namen ein.",
      phone: "Bitte geben Sie Ihre Telefonnummer ein.",
    },
    mailSubject: "Rückrufbitte über die Website",
  },
} as const;
