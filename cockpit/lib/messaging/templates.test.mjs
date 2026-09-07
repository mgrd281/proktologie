import { test } from "node:test";
import assert from "node:assert/strict";

const tpl = await import("./templates.ts");

const ctx = {
  firstName: "Erika",
  lastName: "Musterfrau",
  typeLabel: "Kontrolltermin",
  startsAt: new Date("2026-07-14T05:00:00Z"),
  endsAt: new Date("2026-07-14T05:20:00Z"),
  ref: "PE-4F7K",
  practiceName: "Proktologie Eimsbüttel",
  address: "Schäferkampsallee 56, 20357 Hamburg",
  phone: "040 490 80 21",
  manageUrl: "https://cockpit.example/t/#abc",
};

test("Bestätigung: Kernangaben, Verwaltungslink, keine medizinischen Inhalte ohne Vorlage", () => {
  const m = tpl.confirmation(ctx);
  assert.match(m.subject, /14\. Juli 2026/);
  assert.match(m.text, /Kontrolltermin/);
  assert.match(m.text, /07:00 Uhr/);
  assert.match(m.text, /PE-4F7K/);
  assert.match(m.text, /https:\/\/cockpit\.example\/t\/#abc/);
  assert.doesNotMatch(m.text, /Vorbereitung/);
  const withPrep = tpl.confirmation({ ...ctx, prepText: "Bitte nüchtern kommen." });
  assert.match(withPrep.text, /Hinweise zur Vorbereitung:\nBitte nüchtern kommen\./);
});

test("Absage unterscheidet Urheber", () => {
  assert.match(tpl.cancellation(ctx, "patient").text, /Sie haben Ihren Termin abgesagt/);
  assert.match(tpl.cancellation(ctx, "praxis").text, /Praxis musste/);
  assert.match(tpl.cancellation(ctx, "system").text, /Reservierung ist abgelaufen/);
});

test("Erinnerung: 24 h → morgen, 48 h → in 2 Tagen", () => {
  assert.match(tpl.reminder(ctx, 24).subject, /morgen/);
  assert.match(tpl.reminder(ctx, 48).subject, /in 2 Tagen/);
});

test("Wartelisten-Angebot nennt die Reservierungsfrist", () => {
  const m = tpl.waitlistOffer({ ...ctx, holdUntil: new Date("2026-07-10T12:00:00Z") });
  assert.match(m.text, /reserviert/);
  assert.match(m.text, /14:00 Uhr/);
});

test("HTML-Fassung escapet und verlinkt", () => {
  const html = tpl.textToHtml("Hallo <Welt>\n\nhttps://example.org/x");
  assert.match(html, /Hallo &lt;Welt&gt;/);
  assert.match(html, /<a href="https:\/\/example\.org\/x"/);
});

// ---- Sprache der Buchung ----

const en = { ...ctx, locale: "en" };

test("Englisch: Anrede, Betreff und Kernangaben auf Englisch, Datum englisch formatiert", () => {
  const m = tpl.confirmation(en);
  assert.match(m.subject, /^Your appointment on Tuesday, 14 July 2026 · Proktologie Eimsbüttel$/);
  assert.match(m.text, /^Dear Erika Musterfrau,/);
  assert.match(m.text, /Your appointment is confirmed:/);
  assert.match(m.text, /Reference PE-4F7K/);
  assert.match(m.text, /Confirm, reschedule or cancel your appointment:/);
  assert.match(m.text, /The calendar entry is attached\./);
  assert.match(m.text, /This e-mail was generated automatically/);
  // Kein deutscher Rest
  assert.ok(!/Guten Tag|Referenz |Uhr\b|Wir freuen uns/.test(m.text), m.text);
});

test("Englische Erinnerung und Absage sprechen dieselbe Sprache", () => {
  assert.match(tpl.reminder(en, 24).subject, /Reminder: your appointment tomorrow/);
  assert.match(tpl.reminder(en, 48).subject, /Reminder: your appointment in 2 days/);
  assert.match(tpl.cancellation(en, "patient").text, /You have cancelled your appointment/);
  assert.match(tpl.cancellation(en, "praxis").text, /the practice had to cancel/i);
  assert.match(tpl.rescheduled(en).subject, /Your appointment has been moved/);
  assert.match(tpl.waitlistOffer({ ...en, holdUntil: new Date("2026-07-14T09:00:00Z") }).text, /reserved for you until/);
  assert.match(tpl.waitlistJoined({ ...en, windowText: null }).text, /waiting list for/);
});

test("Ohne Sprache bleibt alles deutsch", () => {
  const m = tpl.confirmation(ctx);
  assert.match(m.text, /^Guten Tag Erika Musterfrau,/);
  assert.match(m.subject, /Ihr Termin am Dienstag, 14\. Juli 2026/);
});

test("Anfahrt und Mitbringen erscheinen nur, wenn die Praxis sie hinterlegt hat", () => {
  const ohne = tpl.confirmation(ctx);
  assert.ok(!/Anfahrt:|Bitte mitbringen:/.test(ohne.text));
  const mit = tpl.confirmation({ ...ctx, directionsText: "U2 Christuskirche", bringText: "Versichertenkarte" });
  assert.match(mit.text, /Anfahrt:\nU2 Christuskirche/);
  assert.match(mit.text, /Bitte mitbringen:\nVersichertenkarte/);
});

test("HTML trägt die Sprache im lang-Attribut", () => {
  assert.match(tpl.textToHtml("Hallo"), /<html lang="de">/);
  assert.match(tpl.textToHtml("Hello", "en"), /<html lang="en">/);
});

// ---- Meldungen an die Praxis ----

test("Praxis-Meldung zur Buchung: deutsch, knapp, ohne Gesundheitsbezug", () => {
  const m = tpl.practiceBookingNotice({
    typeLabel: "Kontrolltermin",
    startsAt: new Date("2026-07-14T05:00:00Z"),
    ref: "PE-4F7K",
    patientName: "Erika Musterfrau",
    phone: "040 000 0000",
    email: "erika@example.invalid",
    source: "chat",
    locale: "de",
    cockpitUrl: "https://cockpit.example/termine?v=tag&d=2026-07-14",
  });
  assert.match(m.subject, /^Neue Buchung: Kontrolltermin am Dienstag, 14\. Juli 2026 · PE-4F7K$/);
  assert.match(m.text, /Über den Chat-Assistenten wurde ein Termin gebucht/);
  assert.match(m.text, /Erika Musterfrau/);
  assert.match(m.text, /Telefon 040 000 0000/);
  assert.match(m.text, /Im Cockpit ansehen:/);
  assert.ok(!/Beschwerden|Diagnose|Symptom|Medikament/i.test(m.text));
});

test("Praxis-Meldung zur Buchung nennt fehlende Angaben und englische Sprache", () => {
  const m = tpl.practiceBookingNotice({
    typeLabel: "Erstuntersuchung",
    startsAt: new Date("2026-07-14T05:00:00Z"),
    ref: "PE-AAAA",
    patientName: "John Doe",
    phone: null,
    email: null,
    source: "chat",
    locale: "en",
    cockpitUrl: null,
  });
  assert.match(m.text, /Telefon nicht angegeben/);
  assert.match(m.text, /E-Mail nicht angegeben/);
  assert.match(m.text, /Sprache: Englisch/);
  assert.ok(!/Im Cockpit ansehen/.test(m.text));
});

test("Praxis-Meldung zur Anfrage nennt Art, Erreichbarkeit und Referenz", () => {
  const m = tpl.practiceCallbackNotice({
    kindLabel: "Rückruf",
    ref: "AN-7K2M",
    patientName: "Max Mustermann",
    phone: "040 111 1111",
    preferredTime: "vormittags",
    note: "Bitte vormittags anrufen",
    locale: "de",
    cockpitUrl: "https://cockpit.example/anfragen",
  });
  assert.match(m.subject, /^Neue Anfrage: Rückruf · AN-7K2M$/);
  assert.match(m.text, /Erreichbar: vormittags/);
  assert.match(m.text, /Bitte vormittags anrufen/);
  assert.match(m.text, /Im Posteingang öffnen:/);
});
