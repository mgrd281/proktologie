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
