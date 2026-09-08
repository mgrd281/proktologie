/**
 * Das Messgerät: Wie viele echte Patientensätze versteht der Automat ohne
 * Modell? Jeder Satz im Korpus trägt eine Erwartungsklasse; dieser Test
 * schickt ihn durch `runTurn` mit gestellten Abhängigkeiten und prüft
 * die Antwort gegen die Klasse. Am Ende steht die Trefferquote je Klasse.
 *
 * Zwei Tore:
 *  - Sicherheitsklassen müssen zu 100 % stimmen (Notfall, Gesundheitsfilter,
 *    medizinische Ablehnung, Fremdsprache, Buchen nur bei reinem Ja).
 *  - Die Gesamtquote darf nicht unter CORPUS_GATE fallen (Standard unten).
 *    Lieferung 1 hat gemessen (64,6 %), Lieferung 2 hebt das Tor auf 95 %.
 *
 * Was diese Zahl NICHT ist: ein Beweis, dass der Assistent jeden Patienten
 * versteht. Der Korpus ist von uns geschrieben; er misst, ob die Sätze, die
 * wir für typisch halten, richtig ankommen. Er ist ein Netz gegen
 * Rückschritte, keine Feldstudie. Neue echte Sätze gehören deshalb laufend
 * hinein – auch und gerade solche, die heute scheitern.
 *
 * Ausführen:  node --test lib/chat/corpus.test.mjs
 *             CORPUS_VERBOSE=1 zeigt jeden Fehlschlag.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { makeDeps, msg, stateAt } from "./testkit.mjs";

const o = await import("./orchestrator.ts");
const { PRAXIS_WISSEN } = await import("../../content/praxis-wissen.ts");
const { t } = await import("./texts.ts");

const GATE = Number(process.env.CORPUS_GATE ?? "0.95");
const VERBOSE = process.env.CORPUS_VERBOSE === "1";
const BOOKING_STAGES = ["type", "date", "time", "contact", "confirm"];
const SAFETY = ["emergency", "health_hint", "medical_refusal", "foreign_safe", "bare_yes"];

const load = (name) => JSON.parse(readFileSync(new URL(`./corpus/${name}.json`, import.meta.url), "utf8"));
const CORPUS = [
  ...load("de").map((e) => ({ ...e, lang: "de" })),
  ...load("en").map((e) => ({ ...e, lang: "en" })),
  ...load("foreign").map((e) => ({ ...e, lang: "de" })),
];

const fact = (topic, lang) => PRAXIS_WISSEN[topic]?.[lang];
const sameWindow = (a, b) => Boolean(a && b && a.from === b.from && a.to === b.to);
const inRange = (date, w) => Boolean(date && w && date >= w.from && date <= w.to);

/**
 * Antwort auf eine Frage zu einem Thema: der gepflegte Faktentext – oder,
 * wenn die Praxis nichts hinterlegt hat, der ehrliche Satz „weiß ich nicht“
 * samt Zählung des Themas.
 */
function topicReply(r, calls, topic, lang) {
  if (!(topic in PRAXIS_WISSEN)) return false;
  const value = fact(topic, lang);
  if (value === null) {
    return r.reply.includes(t(lang).unknownTopic) && calls.audit.some(([ev, d]) => ev === "chat.unknown_topic" && d?.topic === topic);
  }
  return typeof value === "string" && r.reply.includes(value);
}

/** Erfüllt die Antwort die Erwartungsklasse des Korpuseintrags? */
function judge(e, r, calls) {
  const lang = e.lang;
  const T = t(lang);
  const st = r.state;
  const booking = st.intent === "booking" && BOOKING_STAGES.includes(st.stage);
  const last = calls.availability.at(-1);
  const nextFree = calls.nextFree.at(-1);
  const noModel = calls.classify.length === 0 && calls.phrase.length === 0;
  const typeOk = !e.expectTypeId || st.draft.typeId === e.expectTypeId;
  const dateOk = !e.expectDate || st.draft.date === e.expectDate || last?.datum === e.expectDate;

  switch (e.expect) {
    case "booking_start":
      return booking && !r.flags.emergency && typeOk && (e.expectDate ? dateOk : st.draft.date === null) && calls.book.length === 0;
    case "booking_with_date":
      return booking && dateOk && typeOk && (!e.expectTime || last?.uhrzeit === e.expectTime);
    case "booking_with_time":
      return Boolean(last) && last.uhrzeit === e.expectTime && dateOk && typeOk;
    case "booking_with_window":
      return Boolean(last) && sameWindow(last.fenster, e.expectWindow) && dateOk && typeOk;
    case "earliest":
      return Boolean(nextFree) && (!e.expectWindow || sameWindow(nextFree.fenster, e.expectWindow)) && typeOk;
    case "hours":
      return r.reply.includes(lang === "de" ? "Sprechzeiten:" : "Opening hours:") && !booking;
    case "address":
      return topicReply(r, calls, "adresse", lang) && !booking;
    case "directions":
      return topicReply(r, calls, "anfahrt", lang) && !booking;
    case "service_yes":
      return topicReply(r, calls, "leistungen", lang) && !booking && !r.reply.includes(T.healthHintShort);
    case "service_not_here":
      return topicReply(r, calls, "leistungen", lang) && /darmspiegelung|colonoscopy/i.test(r.reply) && !booking;
    case "insurance":
      return topicReply(r, calls, "kassen", lang) && !booking;
    case "duration":
      return /\d+ (Minuten|minutes)/.test(r.reply) && !booking;
    case "cancel_howto":
      return topicReply(r, calls, "absagen", lang) && !booking;
    case "manage_lookup":
    case "manage_cancel":
    case "manage_reschedule":
    case "manage_confirm":
      return !booking && calls.book.length === 0 && (r.form?.id === "manage" || topicReply(r, calls, "absagen", lang));
    case "emergency":
      return r.flags.emergency === true && (!e.expectLang || r.flags.foreign === e.expectLang);
    case "acute_not_emergency":
      return !r.flags.emergency && (r.reply.includes(T.acute) || topicReply(r, calls, "akut", lang)) && calls.classify.length === 0;
    case "health_hint":
      return r.reply.includes(T.healthHintShort) && noModel && !r.flags.emergency;
    case "medical_refusal":
      return r.reply.includes(T.medicalRefusal) && noModel;
    case "unknown_topic":
      return r.reply.includes(T.unknownTopic) && !booking && !r.flags.emergency;
    case "handover":
      return r.flags.handover === true && r.reply.includes(T.handover);
    case "forward":
      return r.form?.id === "callback" && r.flags.handover === true;
    case "followup_later":
      return Boolean(last) && (last.seite ?? 1) > 1 && last.datum === e.draft?.date;
    case "followup_window":
      return Boolean(last) && sameWindow(last.fenster, e.expectWindow) && last.datum === e.draft?.date;
    case "followup_none":
      return Boolean(nextFree) || (Boolean(last) && last.datum !== e.draft?.date);
    case "followup_other_day":
      if (e.expectDate) return last?.datum === e.expectDate;
      if (e.expectWindow) return inRange(last?.datum, e.expectWindow) || nextFree?.ab === e.expectWindow.from;
      return st.stage === "date" || Boolean(nextFree) || (Boolean(last) && last.datum !== e.draft?.date);
    case "correction_in_confirm":
      return (
        calls.book.length === 0 &&
        st.draft.contact !== null &&
        (!e.expectTime || last?.uhrzeit === e.expectTime) &&
        (!e.expectDate || last?.datum === e.expectDate) &&
        typeOk
      );
    case "bare_yes":
      return calls.book.length === 1;
    case "bare_no":
      return calls.book.length === 0 && r.reply.includes(T.whatToChange);
    case "weekend_closed":
      return r.reply.includes(fact("wochenende", lang)) && calls.book.length === 0;
    case "foreign_safe":
      return r.flags.foreign === e.expectLang && noModel && !r.flags.emergency;
    case "discretion":
    case "first_visit":
    case "doctor":
    case "walkin":
    case "preparation":
    case "contact":
    case "referral":
      return topicReply(r, calls, e.expectTopic, lang) && !booking;
    default:
      throw new Error(`Unbekannte Erwartungsklasse: ${e.expect} (${e.id})`);
  }
}

async function run(e) {
  const { deps, calls } = makeDeps();
  const state = e.stage === "idle" ? null : stateAt(e.stage, e.lang, e.draft ?? {});
  const r = await o.runTurn(msg(state, e.text), deps);
  let ok = false;
  let error = null;
  try {
    ok = judge(e, r, calls);
  } catch (err) {
    error = err;
  }
  return { e, r, calls, ok, error };
}

const results = [];
for (const e of CORPUS) results.push(await run(e));

const byClass = new Map();
for (const x of results) {
  const c = byClass.get(x.e.expect) ?? { total: 0, ok: 0, fails: [] };
  c.total += 1;
  if (x.ok) c.ok += 1;
  else c.fails.push(x);
  byClass.set(x.e.expect, c);
}
const total = results.length;
const passed = results.filter((x) => x.ok).length;
const rate = passed / total;

// Bericht – immer, damit die Zahl sichtbar bleibt
const lines = [`Korpus: ${passed}/${total} verstanden (${(rate * 100).toFixed(1)} %), Tor ${(GATE * 100).toFixed(0)} %`];
for (const [cls, c] of [...byClass.entries()].sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total)) {
  lines.push(`  ${cls.padEnd(24)} ${String(c.ok).padStart(3)}/${String(c.total).padEnd(3)} ${c.ok === c.total ? "✓" : ""}`);
  if (VERBOSE) for (const f of c.fails) lines.push(`      ✗ ${f.e.id} „${f.e.text}“ → stage=${f.r.state.stage} ${f.error ? `FEHLER ${f.error.message}` : `„${f.r.reply.slice(0, 90)}“`}`);
}
console.log(lines.join("\n"));

test("Kein Korpuseintrag wirft einen Fehler", () => {
  const broken = results.filter((x) => x.error);
  assert.equal(broken.length, 0, broken.map((x) => `${x.e.id}: ${x.error.message}`).join("\n"));
});

test("Gebucht wird nur bei einem reinen Ja", () => {
  const wrong = results.filter((x) => x.e.expect !== "bare_yes" && x.calls.book.length > 0);
  assert.equal(wrong.length, 0, wrong.map((x) => `${x.e.id} „${x.e.text}“ hat gebucht`).join("\n"));
});

test("Sicherheitsklassen stimmen zu 100 %", () => {
  const bad = results.filter((x) => SAFETY.includes(x.e.expect) && !x.ok);
  assert.equal(bad.length, 0, bad.map((x) => `${x.e.id} [${x.e.expect}] „${x.e.text}“ → „${x.r.reply.slice(0, 80)}“`).join("\n"));
});

test("Kein Modellaufruf mit Gesundheitsangaben oder in Fremdsprachen", () => {
  const leaked = results.filter((x) => ["health_hint", "medical_refusal", "foreign_safe", "emergency"].includes(x.e.expect) && (x.calls.classify.length || x.calls.phrase.length));
  assert.equal(leaked.length, 0, leaked.map((x) => x.e.id).join(", "));
});

test(`Gesamtquote liegt über dem Tor (${(GATE * 100).toFixed(0)} %)`, () => {
  assert.ok(rate >= GATE, `nur ${(rate * 100).toFixed(1)} % – Bericht oben`);
});
