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

export interface BookingStep {
  id: string;
  /** Kurzname – Fortschritt, Vorschau in der Kamerafahrt, Startkarte */
  short: string;
  /** Überschrift des Schritts im Dialog */
  title: string;
  /** Ein Satz darunter – nur, wo er wirklich hilft */
  description?: string;
}

export const bookingSteps: readonly BookingStep[] = [
  {
    id: "type",
    short: "Terminart",
    title: "Welchen Termin benötigen Sie?",
    description: "Wählen Sie den passenden Grund für Ihren Besuch.",
  },
  { id: "date", short: "Datum", title: "Wann möchten Sie kommen?" },
  { id: "time", short: "Uhrzeit", title: "Welche Uhrzeit passt Ihnen?" },
  {
    id: "details",
    short: "Angaben",
    title: "Fast geschafft.",
    description: "Bitte geben Sie Ihre Kontaktdaten ein.",
  },
  { id: "confirm", short: "Bestätigung", title: "Ihr Termin im Überblick" },
];

/** Der Termin-Dialog: Rahmen, Fortschritt und Fußleiste. */
export const bookingDialog = {
  /** Name des Dialogs im verbindlichen Modus (Cockpit) */
  title: "Termin buchen",
  /** Wunschtermin-Modus: Die Praxis bestätigt erst – also „anfragen“ */
  titleRequest: "Termin anfragen",
  stepOf: (step: number, total: number) => `Schritt ${step} von ${total}`,
  close: "Schließen",
  back: "Zurück",
  next: "Weiter",
  /** Knopf der Startkarte in der Termin-Sektion */
  launch: "Online-Termin buchen",
  launchRequest: "Online-Termin anfragen",
  /** Steht neben „Weiter“, solange im Schritt noch nichts gewählt ist */
  required: ["Bitte wählen Sie eine Terminart.", "Bitte wählen Sie einen Tag.", "Bitte wählen Sie eine Uhrzeit."],
  loadingSlots: "Freie Zeiten werden geladen …",
  loadingCalendar: "Kalender wird geladen …",
  /** Übersicht: je Zeile zurück zum passenden Schritt */
  change: "Ändern",
  appointment: "Termin",
  yourDetails: "Ihre Angaben",
  name: "Name",
  email: "E-Mail",
  phone: "Telefon",
} as const;

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
  /**
   * Die Praxis hat die Online-Buchung im Cockpit pausiert und keinen eigenen
   * Text hinterlegt – die Website fällt auf den Wunschtermin zurück.
   */
  pausedNotice:
    "Die Online-Buchung ist vorübergehend pausiert. Wunschtermine können Sie weiterhin anfragen – oder rufen Sie uns an.",
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
  /** Gliederung der Uhrzeiten, sobald es vor- und nachmittags Zeiten gibt. */
  slotGroups: { morning: "Vormittag", afternoon: "Nachmittag" },
  /** Knopf über dem Kalender (verbindlicher Modus): ein Tipp zum frühesten Tag. */
  earliestDay: "Frühester freier Tag:",
  /** Zeile unter dem ersten Termin-Knopf der Kamerafahrt. */
  freeFrom: "Freie Termine ab",
  noSlots:
    "An diesem Tag hat die Praxis keine Sprechzeiten. Bitte wählen Sie einen anderen Tag.",
  noSlotsConfirmed:
    "An diesem Tag ist nichts mehr frei. Bitte wählen Sie einen anderen Tag.",
  slotUnavailable: "nicht verfügbar",
  /** Erscheint nur, wenn das Laden der freien Tage spürbar dauert. */
  loadingDays: "Freie Tage werden geladen …",
  /** Laden gescheitert – nie als „alles ausgebucht“ tarnen. */
  loadError: "Die freien Termine konnten gerade nicht geladen werden.",
  retry: "Erneut versuchen",
  /** Ohne JavaScript lässt sich in der Karte nichts wählen – dann direkt das Telefon. */
  noScript: "Die Online-Buchung braucht JavaScript – bitte rufen Sie uns an:",
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
    /** Ladezustand des Absende-Knopfs */
    sendingRequest: "Wird gesendet …",
    sendingConfirmed: "Wird gebucht …",
    change: "Termin ändern",
    requestHint:
      "Die Praxis prüft Ihren Wunschtermin und meldet sich zeitnah mit einer Bestätigung – telefonisch oder per E-Mail.",
    confirmedHint:
      "Mit dem Klick buchen Sie verbindlich. Sie erhalten sofort eine E-Mail mit Kalendereintrag und einem persönlichen Link, über den Sie den Termin bestätigen, verschieben oder absagen können.",
    successHeadingConfirmed: "Termin verbindlich gebucht",
    successConfirmed:
      "Ihre Bestätigung mit Kalendereintrag ist unterwegs. Über den Link in der E-Mail können Sie den Termin jederzeit verschieben oder absagen – ganz ohne Anruf.",
    refLabel: "Ihre Referenz",
    /** Kalenderdatei aus dem Browser – Titel ohne Terminart (Datenschutz) */
    addToCalendar: "In den Kalender",
    calendarTitle: "Termin · Proktologie Eimsbüttel",
    calendarSaved:
      "Die Kalenderdatei ist geladen – öffnen Sie sie, um den Termin in Ihren Kalender zu übernehmen.",
    directions: "Anfahrt",
    /** Die gewählte Zeit wurde gerade vergeben: zurück zu den Zeiten desselben Tages */
    otherTime: "Andere Zeit wählen",
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
    sendConfirmed: "Der Termin konnte gerade nicht gebucht werden. Bitte versuchen Sie es erneut oder rufen Sie uns an.",
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
    firstName: "Vorname",
    lastName: "Nachname",
    phone: "Telefonnummer",
    timeLabel: "Bevorzugte Zeit",
    timeOptions: ["Egal", "Vormittags", "Nachmittags"],
    /* Einwilligung (nur wenn die Bitte ins Praxis-Cockpit geht): Der Link
       ersetzt die Erwähnung im Satz – wie in der Buchung */
    consentPrefix: "Ich habe die",
    consentLinkLabel: "Datenschutzerklärung",
    consentSuffix: "zur Kenntnis genommen und bin mit der Verarbeitung meiner Angaben für den Rückruf einverstanden.",
    submit: "Rückruf anfordern",
    sending: "Wird gesendet …",
    /** Angekommen im Cockpit – danach folgt die Referenz */
    successCockpit: "Danke – wir rufen Sie zurück. Ihre Referenz:",
    success:
      "Ihr E-Mail-Programm öffnet sich mit der vorbereiteten Rückrufbitte. Bitte senden Sie die E-Mail ab.",
    /** mailto kann still scheitern (kein E-Mail-Programm) – dann diese Wege */
    fallbackLead: "Falls sich kein E-Mail-Programm öffnet: Rufen Sie uns an",
    fallbackOr: "oder schreiben Sie an",
    errors: {
      firstName: "Bitte geben Sie Ihren Vornamen ein.",
      lastName: "Bitte geben Sie Ihren Nachnamen ein.",
      phone: "Bitte geben Sie Ihre Telefonnummer ein.",
      consent: "Bitte bestätigen Sie die Datenschutzerklärung.",
      send: "Ihre Rückrufbitte konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut oder rufen Sie uns an.",
    },
    mailSubject: "Rückrufbitte über die Website",
  },
} as const;
