import { fmtLongDate, timeKey } from "../time.ts";

/**
 * Deutsche Vorlagen der Patientenkommunikation. Bewusst ohne medizinische
 * Inhalte – Vorbereitungshinweise kommen ausschließlich aus der von der
 * Praxis gepflegten Vorlage (message_templates, Schlüssel prep:<Terminart>)
 * und werden nur eingefügt, wenn sie existieren.
 */
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
}

const when = (c: TemplateContext) => `${fmtLongDate(c.startsAt)}, ${timeKey(c.startsAt)} Uhr`;
const greet = (c: TemplateContext) => `Guten Tag ${c.firstName} ${c.lastName},`;
const footer = (c: TemplateContext) =>
  `${c.practiceName}\n${c.address}\nTelefon ${c.phone}\n\nDiese E-Mail wurde automatisch erzeugt. Bitte antworten Sie nicht darauf – bei Fragen erreichen Sie uns telefonisch.`;

const manageBlock = (c: TemplateContext, verb = "Termin bestätigen, verschieben oder absagen") =>
  c.manageUrl ? `\n${verb}:\n${c.manageUrl}\n` : "";

const prepBlock = (c: TemplateContext) => (c.prepText ? `\nHinweise zur Vorbereitung:\n${c.prepText}\n` : "");

export function confirmation(c: TemplateContext) {
  return {
    subject: `Ihr Termin am ${fmtLongDate(c.startsAt)} · ${c.practiceName}`,
    text: [
      greet(c),
      "",
      `Ihr Termin ist verbindlich gebucht:`,
      "",
      `${c.typeLabel}`,
      `${when(c)}`,
      `${c.address}`,
      `Referenz ${c.ref}`,
      "",
      "Im Anhang finden Sie den Kalendereintrag.",
      prepBlock(c),
      manageBlock(c),
      "Wir freuen uns auf Sie.",
      "",
      footer(c),
    ].join("\n"),
  };
}

export function rescheduled(c: TemplateContext) {
  return {
    subject: `Ihr Termin wurde verschoben: ${fmtLongDate(c.startsAt)} · ${c.practiceName}`,
    text: [
      greet(c),
      "",
      `Ihr Termin (Referenz ${c.ref}) findet nun zu folgender Zeit statt:`,
      "",
      `${c.typeLabel}`,
      `${when(c)}`,
      `${c.address}`,
      "",
      "Der aktualisierte Kalendereintrag liegt bei.",
      manageBlock(c),
      footer(c),
    ].join("\n"),
  };
}

export function cancellation(c: TemplateContext, by: "patient" | "praxis" | "system") {
  const line =
    by === "patient"
      ? "Sie haben Ihren Termin abgesagt. Vielen Dank für die Nachricht."
      : by === "system"
        ? "Die Reservierung ist abgelaufen; der Termin wurde freigegeben."
        : "Die Praxis musste Ihren Termin leider absagen. Wir bitten um Entschuldigung.";
  return {
    subject: `Termin abgesagt: ${fmtLongDate(c.startsAt)} · ${c.practiceName}`,
    text: [
      greet(c),
      "",
      line,
      "",
      `${c.typeLabel}`,
      `${when(c)}`,
      `Referenz ${c.ref}`,
      "",
      "Der Anhang entfernt den Eintrag aus Ihrem Kalender.",
      "",
      "Einen neuen Termin können Sie jederzeit online oder telefonisch vereinbaren.",
      "",
      footer(c),
    ].join("\n"),
  };
}

export function reminder(c: TemplateContext, hoursBefore: number) {
  const soon = hoursBefore <= 24 ? "morgen" : `in ${Math.round(hoursBefore / 24)} Tagen`;
  return {
    subject: `Erinnerung: Ihr Termin ${soon} · ${c.practiceName}`,
    text: [
      greet(c),
      "",
      `wir erinnern an Ihren Termin:`,
      "",
      `${c.typeLabel}`,
      `${when(c)}`,
      `${c.address}`,
      `Referenz ${c.ref}`,
      prepBlock(c),
      manageBlock(c, "Bitte bestätigen Sie mit einem Klick, dass Sie kommen – oder sagen Sie ab, damit der Termin frei wird"),
      footer(c),
    ].join("\n"),
  };
}

export function waitlistOffer(c: TemplateContext) {
  const until = c.holdUntil ? `${fmtLongDate(c.holdUntil)}, ${timeKey(c.holdUntil)} Uhr` : "in Kürze";
  return {
    subject: `Ein Termin ist frei geworden · ${c.practiceName}`,
    text: [
      greet(c),
      "",
      "Sie stehen bei uns auf der Warteliste – ein passender Termin ist frei geworden:",
      "",
      `${c.typeLabel}`,
      `${when(c)}`,
      `${c.address}`,
      "",
      `Der Termin ist bis ${until} für Sie reserviert. Danach geht das Angebot an die nächste Person weiter.`,
      manageBlock(c, "Termin annehmen"),
      footer(c),
    ].join("\n"),
  };
}

export function waitlistJoined(c: TemplateContext & { windowText: string | null }) {
  return {
    subject: `Warteliste: Eintrag bestätigt · ${c.practiceName}`,
    text: [
      greet(c),
      "",
      `Sie stehen jetzt auf unserer Warteliste für „${c.typeLabel}“${c.windowText ? ` (${c.windowText})` : ""}.`,
      "",
      "Wird ein passender Termin frei, erhalten Sie automatisch ein Angebot per E-Mail. Sie müssen nichts weiter tun.",
      manageBlock(c, "Eintrag zurückziehen"),
      footer(c),
    ].join("\n"),
  };
}

export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = text.split(/\n{2,}/).map((p) => {
    const lines = p.split("\n").map((l) => {
      const e = esc(l);
      return /^https?:\/\/\S+$/.test(l) ? `<a href="${e}" style="color:#446628">${e}</a>` : e;
    });
    return `<p style="margin:0 0 14px;line-height:1.55">${lines.join("<br>")}</p>`;
  });
  return `<!doctype html><html lang="de"><body style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;color:#202520;background:#f7f7f3;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e6e8e2">${paragraphs.join("")}</div></body></html>`;
}
