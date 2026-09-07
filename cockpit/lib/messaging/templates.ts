import { fmtLongDateLocale, timeKey } from "../time.ts";

/**
 * Vorlagen der Patientenkommunikation in der Sprache der Buchung. Bewusst
 * ohne medizinische Inhalte – Vorbereitungshinweise kommen ausschließlich
 * aus der von der Praxis gepflegten Vorlage (message_templates, Schlüssel
 * prep:<Terminart>) und werden nur eingefügt, wenn sie existieren.
 *
 * Die Sprache steht am Termin (appointments.locale) und wird von send.ts
 * mitgegeben; damit folgen Bestätigung, Erinnerung, Verschiebung und
 * Absage automatisch derselben Sprache, in der gebucht wurde.
 */
export type Locale = "de" | "en";

export interface TemplateContext {
  firstName: string;
  lastName: string;
  typeLabel: string;
  startsAt: Date;
  endsAt: Date;
  ref: string;
  practiceName: string;
  address: string;
  phone: string;
  manageUrl: string | null;
  prepText?: string | null;
  /** Für Wartelisten-Angebote: bis wann reserviert */
  holdUntil?: Date | null;
  /** Sprache der Nachricht – fehlt sie, bleibt es bei Deutsch. */
  locale?: Locale;
  /** Anfahrt aus der gepflegten Wissensdatei – nur wenn vorhanden. */
  directionsText?: string | null;
  /** Was mitzubringen ist – nur wenn die Praxis es hinterlegt hat. */
  bringText?: string | null;
}

const loc = (c: TemplateContext): Locale => c.locale ?? "de";

const T = {
  de: {
    greet: (c: TemplateContext) => `Guten Tag ${c.firstName} ${c.lastName},`,
    at: "Uhr",
    ref: (r: string) => `Referenz ${r}`,
    footerAuto: "Diese E-Mail wurde automatisch erzeugt. Bitte antworten Sie nicht darauf – bei Fragen erreichen Sie uns telefonisch.",
    phone: (p: string) => `Telefon ${p}`,
    manageVerb: "Termin bestätigen, verschieben oder absagen",
    prepTitle: "Hinweise zur Vorbereitung:",
    directionsTitle: "Anfahrt:",
    bringTitle: "Bitte mitbringen:",
    confirmSubject: (d: string, p: string) => `Ihr Termin am ${d} · ${p}`,
    confirmLead: "Ihr Termin ist verbindlich gebucht:",
    confirmIcs: "Im Anhang finden Sie den Kalendereintrag.",
    confirmEnd: "Wir freuen uns auf Sie.",
    reschedSubject: (d: string, p: string) => `Ihr Termin wurde verschoben: ${d} · ${p}`,
    reschedLead: (r: string) => `Ihr Termin (Referenz ${r}) findet nun zu folgender Zeit statt:`,
    reschedIcs: "Der aktualisierte Kalendereintrag liegt bei.",
    cancelSubject: (d: string, p: string) => `Termin abgesagt: ${d} · ${p}`,
    cancelByPatient: "Sie haben Ihren Termin abgesagt. Vielen Dank für die Nachricht.",
    cancelBySystem: "Die Reservierung ist abgelaufen; der Termin wurde freigegeben.",
    cancelByPraxis: "Die Praxis musste Ihren Termin leider absagen. Wir bitten um Entschuldigung.",
    cancelIcs: "Der Anhang entfernt den Eintrag aus Ihrem Kalender.",
    cancelEnd: "Einen neuen Termin können Sie jederzeit online oder telefonisch vereinbaren.",
    remindSubject: (soon: string, p: string) => `Erinnerung: Ihr Termin ${soon} · ${p}`,
    remindSoon: (h: number) => (h <= 24 ? "morgen" : `in ${Math.round(h / 24)} Tagen`),
    remindLead: "wir erinnern an Ihren Termin:",
    remindVerb: "Bitte bestätigen Sie mit einem Klick, dass Sie kommen – oder sagen Sie ab, damit der Termin frei wird",
    offerSubject: (p: string) => `Ein Termin ist frei geworden · ${p}`,
    offerLead: "Sie stehen bei uns auf der Warteliste – ein passender Termin ist frei geworden:",
    offerHold: (until: string) => `Der Termin ist bis ${until} für Sie reserviert. Danach geht das Angebot an die nächste Person weiter.`,
    offerSoon: "in Kürze",
    offerVerb: "Termin annehmen",
    joinedSubject: (p: string) => `Warteliste: Eintrag bestätigt · ${p}`,
    joinedLead: (type: string, w: string) => `Sie stehen jetzt auf unserer Warteliste für „${type}“${w}.`,
    joinedInfo: "Wird ein passender Termin frei, erhalten Sie automatisch ein Angebot per E-Mail. Sie müssen nichts weiter tun.",
    joinedVerb: "Eintrag zurückziehen",
  },
  en: {
    greet: (c: TemplateContext) => `Dear ${c.firstName} ${c.lastName},`,
    at: "",
    ref: (r: string) => `Reference ${r}`,
    footerAuto: "This e-mail was generated automatically. Please do not reply – you can reach us by phone.",
    phone: (p: string) => `Phone ${p}`,
    manageVerb: "Confirm, reschedule or cancel your appointment",
    prepTitle: "How to prepare:",
    directionsTitle: "Getting here:",
    bringTitle: "Please bring:",
    confirmSubject: (d: string, p: string) => `Your appointment on ${d} · ${p}`,
    confirmLead: "Your appointment is confirmed:",
    confirmIcs: "The calendar entry is attached.",
    confirmEnd: "We look forward to seeing you.",
    reschedSubject: (d: string, p: string) => `Your appointment has been moved: ${d} · ${p}`,
    reschedLead: (r: string) => `Your appointment (reference ${r}) now takes place at:`,
    reschedIcs: "The updated calendar entry is attached.",
    cancelSubject: (d: string, p: string) => `Appointment cancelled: ${d} · ${p}`,
    cancelByPatient: "You have cancelled your appointment. Thank you for letting us know.",
    cancelBySystem: "The reservation has expired; the slot has been released.",
    cancelByPraxis: "We are sorry – the practice had to cancel your appointment.",
    cancelIcs: "The attachment removes the entry from your calendar.",
    cancelEnd: "You can book a new appointment online or by phone at any time.",
    remindSubject: (soon: string, p: string) => `Reminder: your appointment ${soon} · ${p}`,
    remindSoon: (h: number) => (h <= 24 ? "tomorrow" : `in ${Math.round(h / 24)} days`),
    remindLead: "this is a reminder of your appointment:",
    remindVerb: "Please confirm with one click that you are coming – or cancel so the slot becomes free again",
    offerSubject: (p: string) => `An appointment has become available · ${p}`,
    offerLead: "You are on our waiting list – a matching appointment has become available:",
    offerHold: (until: string) => `The slot is reserved for you until ${until}. After that it goes to the next person.`,
    offerSoon: "shortly",
    offerVerb: "Accept appointment",
    joinedSubject: (p: string) => `Waiting list: entry confirmed · ${p}`,
    joinedLead: (type: string, w: string) => `You are now on our waiting list for “${type}”${w}.`,
    joinedInfo: "When a matching appointment becomes available you will receive an offer by e-mail automatically. Nothing else to do.",
    joinedVerb: "Withdraw entry",
  },
} as const;

const date = (c: TemplateContext, d: Date = c.startsAt) => fmtLongDateLocale(d, loc(c));
const when = (c: TemplateContext, d: Date = c.startsAt) => `${date(c, d)}, ${timeKey(d)}${T[loc(c)].at ? ` ${T[loc(c)].at}` : ""}`;
const greet = (c: TemplateContext) => T[loc(c)].greet(c);
const footer = (c: TemplateContext) =>
  `${c.practiceName}\n${c.address}\n${T[loc(c)].phone(c.phone)}\n\n${T[loc(c)].footerAuto}`;

const manageBlock = (c: TemplateContext, verb?: string) =>
  c.manageUrl ? `\n${verb ?? T[loc(c)].manageVerb}:\n${c.manageUrl}\n` : "";

const prepBlock = (c: TemplateContext) => (c.prepText ? `\n${T[loc(c)].prepTitle}\n${c.prepText}\n` : "");
const directionsBlock = (c: TemplateContext) => (c.directionsText ? `\n${T[loc(c)].directionsTitle}\n${c.directionsText}\n` : "");
const bringBlock = (c: TemplateContext) => (c.bringText ? `\n${T[loc(c)].bringTitle}\n${c.bringText}\n` : "");

export function confirmation(c: TemplateContext) {
  const t = T[loc(c)];
  return {
    subject: t.confirmSubject(date(c), c.practiceName),
    text: [
      greet(c),
      "",
      t.confirmLead,
      "",
      `${c.typeLabel}`,
      `${when(c)}`,
      `${c.address}`,
      t.ref(c.ref),
      "",
      t.confirmIcs,
      prepBlock(c),
      directionsBlock(c),
      bringBlock(c),
      manageBlock(c),
      t.confirmEnd,
      "",
      footer(c),
    ].join("\n"),
  };
}

export function rescheduled(c: TemplateContext) {
  const t = T[loc(c)];
  return {
    subject: t.reschedSubject(date(c), c.practiceName),
    text: [greet(c), "", t.reschedLead(c.ref), "", `${c.typeLabel}`, `${when(c)}`, `${c.address}`, "", t.reschedIcs, manageBlock(c), footer(c)].join("\n"),
  };
}

export function cancellation(c: TemplateContext, by: "patient" | "praxis" | "system") {
  const t = T[loc(c)];
  const line = by === "patient" ? t.cancelByPatient : by === "system" ? t.cancelBySystem : t.cancelByPraxis;
  return {
    subject: t.cancelSubject(date(c), c.practiceName),
    text: [greet(c), "", line, "", `${c.typeLabel}`, `${when(c)}`, t.ref(c.ref), "", t.cancelIcs, "", t.cancelEnd, "", footer(c)].join("\n"),
  };
}

export function reminder(c: TemplateContext, hoursBefore: number) {
  const t = T[loc(c)];
  return {
    subject: t.remindSubject(t.remindSoon(hoursBefore), c.practiceName),
    text: [
      greet(c),
      "",
      t.remindLead,
      "",
      `${c.typeLabel}`,
      `${when(c)}`,
      `${c.address}`,
      t.ref(c.ref),
      prepBlock(c),
      directionsBlock(c),
      bringBlock(c),
      manageBlock(c, t.remindVerb),
      footer(c),
    ].join("\n"),
  };
}

export function waitlistOffer(c: TemplateContext) {
  const t = T[loc(c)];
  const until = c.holdUntil ? when(c, c.holdUntil) : t.offerSoon;
  return {
    subject: t.offerSubject(c.practiceName),
    text: [greet(c), "", t.offerLead, "", `${c.typeLabel}`, `${when(c)}`, `${c.address}`, "", t.offerHold(until), manageBlock(c, t.offerVerb), footer(c)].join("\n"),
  };
}

export function waitlistJoined(c: TemplateContext & { windowText: string | null }) {
  const t = T[loc(c)];
  return {
    subject: t.joinedSubject(c.practiceName),
    text: [greet(c), "", t.joinedLead(c.typeLabel, c.windowText ? ` (${c.windowText})` : ""), "", t.joinedInfo, manageBlock(c, t.joinedVerb), footer(c)].join("\n"),
  };
}

/**
 * Meldungen an die Praxis – immer deutsch, immer kurz, ohne Gesundheitsbezug.
 * Sie ersetzen nicht das Cockpit, sie machen nur aufmerksam.
 */
export interface PracticeBookingNotice {
  typeLabel: string;
  startsAt: Date;
  ref: string;
  patientName: string;
  phone: string | null;
  email: string | null;
  source: string;
  locale: Locale;
  cockpitUrl: string | null;
}

export function practiceBookingNotice(n: PracticeBookingNotice) {
  return {
    subject: `Neue Buchung: ${n.typeLabel} am ${fmtLongDateLocale(n.startsAt, "de")} · ${n.ref}`,
    text: [
      "Über den Chat-Assistenten wurde ein Termin gebucht:",
      "",
      `${n.typeLabel}`,
      `${fmtLongDateLocale(n.startsAt, "de")}, ${timeKey(n.startsAt)} Uhr`,
      `${n.patientName}`,
      n.phone ? `Telefon ${n.phone}` : "Telefon nicht angegeben",
      n.email ? `E-Mail ${n.email}` : "E-Mail nicht angegeben",
      n.locale === "en" ? "Sprache: Englisch – Bestätigung ging auf Englisch raus." : "Sprache: Deutsch",
      `Referenz ${n.ref}`,
      n.cockpitUrl ? `\nIm Cockpit ansehen:\n${n.cockpitUrl}\n` : "",
      "Diese Nachricht dient nur der Information; im Cockpit steht der vollständige Stand.",
    ].join("\n"),
  };
}

export interface PracticeCallbackNotice {
  kindLabel: string;
  ref: string;
  patientName: string;
  phone: string | null;
  preferredTime: string;
  note: string | null;
  locale: Locale;
  cockpitUrl: string | null;
}

export function practiceCallbackNotice(n: PracticeCallbackNotice) {
  return {
    subject: `Neue Anfrage: ${n.kindLabel} · ${n.ref}`,
    text: [
      `Es liegt eine neue Anfrage im Posteingang: ${n.kindLabel}.`,
      "",
      `${n.patientName}`,
      n.phone ? `Telefon ${n.phone}` : "Telefon nicht angegeben",
      `Erreichbar: ${n.preferredTime}`,
      n.locale === "en" ? "Sprache: Englisch – bitte auf Englisch zurückrufen." : "Sprache: Deutsch",
      n.note ? `\nNachricht:\n${n.note}\n` : "",
      `Referenz ${n.ref}`,
      n.cockpitUrl ? `\nIm Posteingang öffnen:\n${n.cockpitUrl}\n` : "",
    ].join("\n"),
  };
}

export function textToHtml(text: string, locale: Locale = "de"): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = text.split(/\n{2,}/).map((p) => {
    const lines = p.split("\n").map((l) => {
      const e = esc(l);
      return /^https?:\/\/\S+$/.test(l) ? `<a href="${e}" style="color:#446628">${e}</a>` : e;
    });
    return `<p style="margin:0 0 14px;line-height:1.55">${lines.join("<br>")}</p>`;
  });
  return `<!doctype html><html lang="${locale}"><body style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;color:#202520;background:#f7f7f3;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e6e8e2">${paragraphs.join("")}</div></body></html>`;
}
