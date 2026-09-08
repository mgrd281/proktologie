/**
 * Der gestellte Sprachanbieter ist selbst Prüfgegenstand: Wenn er sich
 * anders verhält als gedacht, sind alle Aussagen falsch, die mit ihm
 * belegt werden.
 *
 * Ausführen:  node --test lib/voice/fake-provider.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { FakeSpeechProvider, tone, room } = await import("./fake-provider.ts");
const { breached, newUsage, DEFAULT_LIMITS } = await import("./provider.ts");

/** Eine Äußerung: Raumgeräusch, Sprache, dann wieder Ruhe. */
function utterance(session, { voiced = 40, before = 20, after = 40, hz = 220, amplitude = 0.3 } = {}) {
  for (let i = 0; i < before; i++) session.write(room());
  for (let i = 0; i < voiced; i++) session.write(tone(hz, amplitude));
  for (let i = 0; i < after; i++) session.write(room());
}

const kinds = (events) => events.map((e) => e.kind);

async function listening(provider) {
  const events = [];
  const session = await provider.listen({ lang: "de", onEvent: (e) => events.push(e) });
  return { session, events };
}

// ------------------------------------------------------------ Grundfall

test("Eine Äußerung erzeugt Anfang, Ende und den Satz aus dem Drehbuch", async () => {
  const p = new FakeSpeechProvider({ script: ["Ich hätte gern einen Termin"] });
  const { session, events } = await listening(p);
  utterance(session);
  assert.deepEqual(kinds(events), ["speech_started", "speech_stopped", "final", "turn_end"]);
  const final = events.find((e) => e.kind === "final");
  assert.equal(final.text, "Ich hätte gern einen Termin");
  assert.ok(final.durationMs >= 700, `Dauer zu kurz gemessen: ${final.durationMs}`);
});

test("Stille allein erzeugt nichts – und kostet damit auch nichts", async () => {
  const p = new FakeSpeechProvider({ script: ["sollte nie kommen"] });
  const { session, events } = await listening(p);
  for (let i = 0; i < 300; i++) session.write(room());
  assert.deepEqual(events, []);
  assert.equal(p.remaining, 1, "das Drehbuch wurde nicht angerührt");
});

test("Mehrere Äußerungen geben die Sätze der Reihe nach", async () => {
  const p = new FakeSpeechProvider({ script: ["Erstens", "Zweitens", "Drittens"] });
  const { session, events } = await listening(p);
  for (let i = 0; i < 3; i++) utterance(session);
  const texts = events.filter((e) => e.kind === "final").map((e) => e.text);
  assert.deepEqual(texts, ["Erstens", "Zweitens", "Drittens"]);
  assert.equal(p.remaining, 0);
});

test("Ist das Drehbuch zu Ende, kommt kein erfundener Satz", async () => {
  const p = new FakeSpeechProvider({ script: ["Nur einer"] });
  const { session, events } = await listening(p);
  utterance(session);
  utterance(session);
  assert.equal(events.filter((e) => e.kind === "final").length, 1);
});

test("Leiser gesprochen als vorher ergibt einen negativen Relativpegel", async () => {
  const p = new FakeSpeechProvider({ script: ["laut", "laut", "leise"] });
  const { session, events } = await listening(p);
  utterance(session, { amplitude: 0.3 });
  utterance(session, { amplitude: 0.3 });
  utterance(session, { amplitude: 0.03 });
  const finals = events.filter((e) => e.kind === "final");
  assert.equal(finals.length, 3);
  assert.ok(finals[2].relativeDb < -9, `nicht als abgewandt erkennbar: ${finals[2].relativeDb}`);
});

// ------------------------------------------------------------- Betriebsarten

test("Betriebsart „drop“: die Sitzung bricht ab und nimmt danach nichts mehr an", async () => {
  const p = new FakeSpeechProvider({ script: ["kommt nicht mehr"], mode: "drop" });
  const { session, events } = await listening(p);
  for (let i = 0; i < 80; i++) session.write(tone());
  assert.equal(session.open, false);
  const vorher = events.length;
  for (let i = 0; i < 40; i++) session.write(tone());
  assert.equal(events.length, vorher, "nach dem Abbruch kommt nichts mehr");
});

test("Betriebsart „garbage“: Unsinn statt Text, aus dem nichts Verbindliches werden darf", async () => {
  const p = new FakeSpeechProvider({ script: ["ja bitte buchen"], mode: "garbage" });
  const { session, events } = await listening(p);
  utterance(session);
  const final = events.find((e) => e.kind === "final");
  assert.ok(final);
  assert.doesNotMatch(final.text, /ja|buchen/i, "das Drehbuch darf hier nicht durchschlagen");
});

test("Betriebsart „mute“: die Sprachausgabe liefert nichts", async () => {
  const p = new FakeSpeechProvider({ mode: "mute" });
  const frames = [];
  for await (const f of p.speak("Guten Tag", { lang: "de" })) frames.push(f);
  assert.deepEqual(frames, []);
  assert.equal(p.calls.filter((c) => c.kind === "speak").length, 1, "der Versuch wird trotzdem gezählt");
});

test("Betriebsart „slow“: der Satz kommt verzögert, aber er kommt", async () => {
  let waited = 0;
  const p = new FakeSpeechProvider({
    script: ["Ich brauche einen Termin"],
    mode: "slow",
    latencyMs: 1500,
    sleep: async (ms) => {
      waited += ms;
    },
  });
  const { session, events } = await listening(p);
  utterance(session);
  await new Promise((r) => setImmediate(r));
  assert.equal(waited, 1500);
  assert.equal(events.find((e) => e.kind === "final")?.text, "Ich brauche einen Termin");
});

// ------------------------------------------------------- Sprachausgabe

test("Gesprochener Text kommt in Stücken, nicht erst am Ende", async () => {
  const p = new FakeSpeechProvider();
  const frames = [];
  for await (const f of p.speak("Am Dienstag ist um neun Uhr frei.", { lang: "de" })) frames.push(f);
  assert.ok(frames.length >= 2, `nur ${frames.length} Stück – das wäre eine hörbare Pause`);
  assert.ok(frames[0] instanceof Int16Array);
});

test("Ein Abbruch unterbricht die Ausgabe sofort und wird gezählt", async () => {
  const p = new FakeSpeechProvider();
  const controller = new AbortController();
  const frames = [];
  for await (const f of p.speak("Ein langer Satz, der unterbrochen werden soll und deshalb viele Stücke hat.", { lang: "de", signal: controller.signal })) {
    frames.push(f);
    if (frames.length === 2) controller.abort();
  }
  assert.equal(frames.length, 2, "nach dem Abbruch kommt nichts mehr");
  assert.equal(p.aborted, 1);
});

// -------------------------------------------------------------- Protokoll

test("Jeder Aufruf wird mitgeschrieben – ein Nebengespräch erzeugt nachweislich keinen", async () => {
  const p = new FakeSpeechProvider({ script: ["egal"] });
  await listening(p);
  assert.deepEqual(
    p.calls.map((c) => c.kind),
    ["listen"],
  );
  p.reset();
  assert.deepEqual(p.calls, []);
});

// ----------------------------------------------------------- Grenzen

test("Die harten Grenzen greifen, bevor eine Rechnung überrascht", () => {
  const usage = newUsage();
  assert.equal(breached(usage, 0, 0), null);
  assert.equal(breached(usage, DEFAULT_LIMITS.maxSessionMs, 0), "session_time");
  assert.equal(breached({ ...usage, sttSeconds: DEFAULT_LIMITS.maxSttSeconds }, 0, 0), "stt_seconds");
  assert.equal(breached({ ...usage, ttsChars: DEFAULT_LIMITS.maxTtsChars }, 0, 0), "tts_chars");
  assert.equal(breached(usage, 0, DEFAULT_LIMITS.maxTurns), "turns");
});

test("Die Grenzen sind so gesetzt, dass ein vergessener Tab nicht teuer wird", () => {
  // Sechs Minuten übertragenes Audio je Sitzung: Selbst bei tausend
  // Sitzungen im Monat bleibt das im zweistelligen Bereich. Ohne diese
  // Grenze wäre ein über Nacht offener Tab die größte Position.
  assert.ok(DEFAULT_LIMITS.maxSttSeconds <= 10 * 60);
  assert.ok(DEFAULT_LIMITS.maxSessionMs <= 15 * 60_000);
});
