/**
 * Datum und Uhrzeit aus dem, was Menschen sagen.
 *
 * Die Fallen stehen zuerst, weil sie der Grund für dieses Modul sind: Der
 * frühere Parser las „so" als Sonntag, „do" als Donnerstag und „Morgen"
 * im Gruß als morgen – und buchte überzeugt den falschen Tag.
 *
 * Bühne: Montag, 13. Juli 2026.
 *
 * Ausführen:  node --test lib/chat/datetime.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { parseDate, parseTime, DAY_START, DAY_END } = await import("./datetime.ts");

const NOW = new Date("2026-07-13T06:00:00Z"); // Montag
const d = (text, lang = "de") => parseDate(text, NOW, lang);
const t = (text, lang = "de") => parseTime(text, lang);
const day = (text, lang = "de") => d(text, lang)?.date ?? null;
const exact = (text, lang = "de") => {
  const hit = t(text, lang);
  return hit?.kind === "exact" ? hit.time : null;
};
const window_ = (text, lang = "de") => {
  const hit = t(text, lang);
  return hit && hit.from ? `${hit.from}-${hit.to}` : null;
};

// ---------------------------------------------------------------- Fallen

test("Ein Gruß ist kein Datum", () => {
  assert.equal(day("Guten Morgen, ich hätte gern einen Termin"), null);
  assert.equal(day("Guten Tag"), null);
  assert.equal(day("Good morning, I would like an appointment", "en"), null);
});

test("„morgens“ ist ein Tagesteil, „morgen“ ein Tag", () => {
  assert.equal(day("morgen"), "2026-07-14");
  assert.equal(day("Um 8 Uhr morgens"), null, "morgens darf keinen Tag setzen");
  assert.equal(exact("Um 8 Uhr morgens"), "08:00");
});

test("„so früh wie möglich“ ist kein Sonntag", () => {
  assert.equal(day("So früh wie möglich"), null);
  assert.equal(t("So früh wie möglich")?.kind, "earliest");
  assert.equal(day("Schnellstmöglich bitte"), null);
});

test("„do i need“ ist kein Donnerstag", () => {
  assert.equal(day("do i need a referral", "en"), null);
  assert.equal(day("Do you have anything free?", "en"), null);
});

// ---------------------------------------------------------------- Datum

test("Heute, morgen, übermorgen", () => {
  assert.equal(day("Geht heute noch was?"), "2026-07-13");
  assert.equal(day("Kann ich übermorgen kommen?"), "2026-07-15");
  assert.equal(day("Do you have anything tomorrow?", "en"), "2026-07-14");
  assert.equal(day("Can I come the day after tomorrow?", "en"), "2026-07-15");
});

test("Ein Wochentag meint das nächste Vorkommen – heute zählt nicht mit", () => {
  assert.equal(day("Haben Sie am Dienstag noch was frei?"), "2026-07-14");
  assert.equal(day("Donnerstag wäre mir am liebsten"), "2026-07-16");
  // Heute ist Montag: „Montag" heißt nächste Woche, nicht heute.
  assert.equal(day("Geht Montag?"), "2026-07-20");
});

test("„nächsten Dienstag“ ist die nächste Kalenderwoche, nicht schon morgen", () => {
  assert.equal(day("Nächsten Dienstag"), "2026-07-21");
  assert.equal(day("Kontrolltermin nächste Woche Dienstag"), "2026-07-21");
  assert.equal(day("next Tuesday please", "en"), "2026-07-21");
});

test("Kurzformen zählen nur mit Anlass", () => {
  assert.equal(day("Ich könnte am Do."), "2026-07-16");
  assert.equal(day("Mi. wäre gut"), "2026-07-15");
});

test("Geschriebene Datumsangaben, deutsch und englisch", () => {
  assert.equal(day("Termin am 16.7."), "2026-07-16");
  assert.equal(day("16.07.2026 bitte"), "2026-07-16");
  assert.equal(day("2026-07-16"), "2026-07-16");
  assert.equal(day("Am 3. Oktober"), "2026-10-03");
  assert.equal(day("3. Okt geht bei mir"), "2026-10-03");
  assert.equal(day("Ich hätte gern einen Termin am 16. Juli"), "2026-07-16");
  assert.equal(day("October 3rd", "en"), "2026-10-03");
  assert.equal(day("On the 16th of July", "en"), "2026-07-16");
  assert.equal(day("16/07/2026", "en"), "2026-07-16");
});

test("„in drei Tagen“", () => {
  assert.equal(day("Termin in 3 Tagen"), "2026-07-16");
  assert.equal(day("in zwei Tagen"), "2026-07-15");
});

test("Wochen als Bereich – Montag bis Freitag, denn am Wochenende ist zu", () => {
  assert.deepEqual(d("Diese Woche noch bitte"), { kind: "range", from: "2026-07-13", to: "2026-07-17" });
  assert.deepEqual(d("Nächste Woche irgendwann"), { kind: "range", from: "2026-07-20", to: "2026-07-24" });
  assert.deepEqual(d("In zwei Wochen"), { kind: "range", from: "2026-07-27", to: "2026-07-31" });
  assert.deepEqual(d("Sometime next week", "en"), { kind: "range", from: "2026-07-20", to: "2026-07-24" });
});

test("Monatsteile und Wochenende", () => {
  assert.deepEqual(d("Anfang Oktober"), { kind: "range", from: "2026-10-01", to: "2026-10-10" });
  assert.deepEqual(d("Ende der Woche wäre gut"), { kind: "range", from: "2026-07-16", to: "2026-07-17" });
  assert.equal(d("Geht auch am Wochenende?")?.kind, "weekend");
  assert.equal(d("Samstag")?.kind, "weekend");
});

test("Beim Verschieben zählt der Zieltag, nicht der alte", () => {
  assert.equal(day("Kann ich meinen Termin von Dienstag auf Donnerstag verschieben?"), "2026-07-16");
});

// -------------------------------------------------------------- Uhrzeit

test("Uhrzeiten in Ziffern", () => {
  assert.equal(exact("Dienstag 14:30"), "14:30");
  assert.equal(exact("Geht 14.30 Uhr am Donnerstag?"), "14:30");
  assert.equal(exact("morgen 7:30"), "07:30");
  assert.equal(exact("2:30 pm", "en"), "14:30");
  assert.equal(exact("Friday 14:30", "en"), "14:30");
});

test("Uhrzeiten in Worten – und immer innerhalb der Sprechzeiten", () => {
  assert.equal(exact("halb drei am Freitag"), "14:30", "nachts hat niemand offen");
  assert.equal(exact("halb 3"), "14:30");
  assert.equal(exact("viertel nach zwei"), "14:15");
  assert.equal(exact("viertel vor zehn"), "09:45");
  assert.equal(exact("half past two", "en"), "14:30");
  assert.equal(exact("quarter past nine on Wednesday", "en"), "09:15");
});

test("Nackte Stunden", () => {
  assert.equal(exact("14 Uhr"), "14:00");
  assert.equal(exact("Termin um 10"), "10:00");
  assert.equal(exact("Morgen um 9 Uhr"), "09:00");
  assert.equal(exact("10 o'clock", "en"), "10:00");
  assert.equal(exact("tomorrow at 9", "en"), "09:00");
  assert.equal(exact("yes but at 3 pm", "en"), "15:00");
});

test("Tagesteile werden zu Fenstern innerhalb der Sprechzeiten", () => {
  assert.equal(window_("Ich könnte nur vormittags"), "07:00-12:00");
  assert.equal(window_("Lieber nachmittags"), "12:00-18:00");
  assert.equal(window_("Abends wäre gut"), "16:00-18:00", "nicht bis Mitternacht");
  assert.equal(window_("In der Mittagspause"), "12:00-14:00");
  assert.equal(window_("afternoon please", "en"), "12:00-18:00");
});

test("Zusammengesetzte Wörter: Dienstagnachmittag ist Tag und Tagesteil", () => {
  assert.equal(day("Dienstagnachmittag"), "2026-07-14");
  assert.equal(window_("Dienstagnachmittag"), "12:00-18:00");
  assert.equal(day("morgen früh"), "2026-07-14");
  assert.equal(window_("morgen früh"), "07:00-12:00");
  assert.equal(window_("tomorrow morning", "en"), "07:00-12:00");
});

test("Grenzen: nach, vor, zwischen, gegen", () => {
  assert.equal(window_("am Freitag nach 16 Uhr"), "16:00-18:00");
  assert.equal(window_("Vor 9 Uhr"), "07:00-09:00");
  assert.equal(window_("Zwischen 14 und 16 Uhr"), "14:00-16:00");
  assert.equal(window_("gegen 10"), "09:30-10:30");
  assert.equal(window_("so gegen halb zehn"), "09:00-10:00");
  assert.equal(window_("between 2 and 4", "en"), "14:00-16:00");
  assert.equal(window_("after 4 pm", "en"), "16:00-18:00");
  assert.equal(window_("before 9 if possible", "en"), "07:00-09:00");
});

test("„nach der Arbeit“ ist ein Fenster – auch wenn im selben Satz eine Uhrzeit steht", () => {
  assert.equal(window_("Nach der Arbeit, also ab 16 Uhr"), "16:00-18:00");
  assert.equal(window_("nach der Arbeit"), "16:00-18:00");
  assert.equal(window_("after work", "en"), "16:00-18:00");
});

test("Eine genannte Uhrzeit schlägt den Tagesteil", () => {
  assert.equal(exact("Um 8 Uhr morgens am Mittwoch"), "08:00");
  assert.equal(exact("Termin morgen früh um 8?"), "08:00");
});

test("„so früh wie möglich, aber vormittags“ ist beides", () => {
  const hit = t("Ich nehme den ersten freien Termin, am liebsten vormittags");
  assert.equal(hit?.kind, "earliest");
  assert.equal(hit?.from, "07:00");
  assert.equal(hit?.to, "12:00");
});

test("Kein Fenster reicht über die Sprechzeiten hinaus", () => {
  for (const text of ["nach 20 Uhr", "vor 5 Uhr", "zwischen 20 und 23 Uhr"]) {
    const hit = t(text);
    if (hit?.from) {
      assert.ok(hit.from >= DAY_START, `${text}: ${hit.from}`);
      assert.ok(hit.to <= DAY_END, `${text}: ${hit.to}`);
    }
  }
});

test("Was keine Zeitangabe ist, wird auch nicht zu einer", () => {
  for (const text of ["Ich hätte gern einen Termin", "Wo finde ich Sie?", "Brauche ich eine Überweisung?"]) {
    assert.equal(t(text), null, text);
  }
});

const t2 = (text, lang = "de") => parseTime(text, lang);
const d2 = (text, lang = "de") => parseDate(text, NOW, lang);

test("„So früh wie möglich“ ist kein Vormittag", () => {
  const a = t2("So früh wie möglich bitte", "de");
  assert.equal(a?.kind, "earliest");
  assert.equal(a?.from, undefined, "kein Fenster – sonst bleibt 14:00 verborgen, obwohl es früher ist");
  const b = t2("Ich nehme den ersten freien Termin, am liebsten vormittags", "de");
  assert.equal(b?.kind, "earliest");
  assert.equal(b?.from, "07:00");
  assert.equal(b?.to, "12:00");
});

test("Eine Kurzform braucht einen Anlass, sonst ist sie ein gewöhnliches Wort", () => {
  assert.equal(d2("so gegen halb zehn", "de"), null, "„so“ ist hier kein Sonntag");
  assert.equal(d2("do i need a referral", "en"), null, "„do“ ist hier kein Donnerstag");
  assert.equal(d2("Sa. 10 Uhr?", "de")?.kind, "weekend");
  assert.equal(d2("am di 14 uhr", "de")?.date, "2026-07-14");
});
