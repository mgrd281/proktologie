/**
 * Die Zuhör-Sitzung gegen gestellte Bausteine: kein Browser, kein Netz,
 * kein Anbieter. Geprüft wird das, was Geld und Vertrauen kostet – dass
 * das Mikrofon nur auf Knopfdruck aufgeht und bei jedem Zweifel wieder zu.
 *
 * Ausführen:  node --experimental-strip-types --test lib/voice/live.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { LiveSession } = await import("./live.ts");

const SECRET = { value: "ek_test", expiresAt: 0, sampleRate: 24000 };

function harness(over = {}) {
  const calls = { token: 0, mic: 0, connect: 0, close: 0, stopped: 0, transcripts: [], states: [], reasons: [] };
  let events = null;
  const track = { stop: () => { calls.stopped += 1; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const ports = {
    token: async () => { calls.token += 1; return SECRET; },
    microphone: async () => { calls.mic += 1; return stream; },
    connect: async (_s, _st, on) => {
      calls.connect += 1;
      events = on;
      return { close: () => { calls.close += 1; } };
    },
    onTranscript: (t) => calls.transcripts.push(t),
    onState: (s, detail) => { calls.states.push(s); calls.reasons.push(detail?.reason ?? null); },
    ...over,
  };
  return { session: new LiveSession(ports), calls, fire: () => events };
}

test("Das Mikrofon geht nur auf Knopfdruck auf", async () => {
  const { session, calls } = harness();
  assert.equal(session.current, "idle");
  assert.equal(calls.mic, 0, "ohne Druck kein Mikrofon");
  await session.start();
  assert.equal(calls.mic, 1);
  assert.equal(session.current, "listening");
  assert.deepEqual(calls.states, ["connecting", "listening"]);
  // Jede Testreihe räumt ihr Mikrofon selbst weg: Eine laufende Sitzung
  // hält ihren Stille-Wecker und damit den ganzen Lauf neunzig Sekunden am
  // Leben.
  await session.stop();
});

test("Ein erkannter Satz geht weiter, ein leerer nicht", async () => {
  const { session, calls, fire } = harness();
  await session.start();
  fire().transcript("   ");
  assert.deepEqual(calls.transcripts, [], "Stille ist keine Frage");
  assert.equal(session.current, "listening");
  fire().transcript("  Geht Dienstag nachmittags?  ");
  assert.deepEqual(calls.transcripts, ["Geht Dienstag nachmittags?"]);
  assert.equal(session.current, "answering", "solange der Automat antwortet, wird nicht neu gestartet");
  session.answered();
  assert.equal(session.current, "listening");
  await session.stop();
});

test("Aufhören schließt die Leitung und das Mikrofon – auch mehrfach gedrückt", async () => {
  const { session, calls } = harness();
  await session.start();
  await session.stop();
  assert.equal(calls.close, 1, "Leitung zu");
  assert.equal(calls.stopped, 1, "Mikrofon zu");
  assert.equal(session.current, "idle");
  await session.stop();
  assert.equal(calls.close, 1, "kein zweites Schließen");
});

test("Verweigerte Erlaubnis sagt das ehrlich, statt so zu tun als höre sie zu", async () => {
  const { session, calls } = harness({
    microphone: async () => {
      const e = new Error("nein");
      e.name = "NotAllowedError";
      throw e;
    },
  });
  await session.start();
  assert.equal(session.current, "denied");
  assert.equal(calls.connect, 0, "ohne Mikrofon keine Leitung");
});

test("Bricht die Leitung ab, wird aufgeräumt statt stumm weiterzulaufen", async () => {
  const { session, calls, fire } = harness();
  await session.start();
  fire().closed("failed");
  assert.equal(session.current, "idle");
  assert.equal(calls.stopped, 1, "das Mikrofon bleibt nicht offen");
});

test("Wer mitten im Verbinden abbricht, lässt kein offenes Mikrofon zurück", async () => {
  let freigeben;
  const warten = new Promise((r) => { freigeben = r; });
  const { session, calls } = harness({
    microphone: async () => {
      await warten;
      const track = { stop: () => { calls.stopped += 1; } };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    },
  });
  const laeuft = session.start();
  await session.stop();
  freigeben();
  await laeuft;
  assert.equal(session.current, "idle");
  assert.equal(calls.stopped, 1, "das gerade geöffnete Mikrofon wird sofort wieder geschlossen");
  assert.equal(calls.connect, 0, "und es wird gar nicht erst verbunden");
});

test("Nach einem Fehler genügt ein Knopfdruck, nicht zwei", async () => {
  // Wer einmal auf einen Fehler läuft – Netz weg, Ausweis abgelehnt – hält
  // den Knopf für kaputt, wenn der erste Druck danach nichts tut. Die
  // Sitzung muss aus „error" heraus direkt wieder starten können.
  let kaputt = true;
  const { session, calls } = harness({
    token: async () => {
      if (kaputt) throw new Error("voice/token 502");
      return SECRET;
    },
  });
  await session.start();
  assert.equal(session.current, "error");
  // Das Mikrofon wird zuerst geholt (damit der Browser aus der Geste heraus
  // fragt) und bei scheiterndem Ausweis sofort wieder geschlossen.
  assert.equal(calls.mic, 1, "Mikrofon zuerst geholt");
  assert.equal(calls.stopped, 1, "und bei Ausweis-Fehler sofort wieder geschlossen");
  kaputt = false;
  await session.start();
  assert.equal(session.current, "listening");
  assert.equal(calls.mic, 2);
  // Aufräumen: Eine laufende Sitzung hält sonst ihren Stille-Wecker und
  // damit die ganze Testreihe neunzig Sekunden am Leben.
  await session.stop();
});

test("Eine abgelehnte Erlaubnis ist kein Absturz, und der zweite Versuch ist erlaubt", async () => {
  let abgelehnt = true;
  const { session } = harness({
    microphone: async () => {
      if (abgelehnt) {
        const e = new Error("verweigert");
        e.name = "NotAllowedError";
        throw e;
      }
      const track = { stop: () => {} };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    },
  });
  await session.start();
  assert.equal(session.current, "denied", "abgelehnt ist etwas anderes als kaputt");
  abgelehnt = false;
  await session.start();
  assert.equal(session.current, "listening");
  await session.stop();
});

test("Zwischentext wächst mit und verschwindet, wenn der Satz fertig ist", async () => {
  const partials = [];
  const { session, fire } = harness({ onPartial: (t) => partials.push(t) });
  await session.start();
  fire().partial("Ich hätte");
  fire().partial(" gern einen Termin");
  assert.deepEqual(partials, ["Ich hätte", "Ich hätte gern einen Termin"]);
  fire().transcript("Ich hätte gern einen Termin.");
  assert.equal(partials.at(-1), "", "bei fertigem Satz ist der Zwischentext leer");
  await session.stop();
});

test("Wer dazwischenredet, bringt den Assistenten zum Schweigen", async () => {
  let unterbrochen = 0;
  const { session, fire } = harness({ onInterrupt: () => (unterbrochen += 1) });
  await session.start();
  fire().transcript("Frage eins");            // → answering
  assert.equal(session.current, "answering");
  fire().speechStart();                        // Patientin redet, während geantwortet wird
  assert.equal(unterbrochen, 1, "die Antwort wird gestoppt");
  assert.equal(session.current, "hearing");
  await session.stop();
});

test("Fehler bekommen eine Ursache – nicht nur „error“", async () => {
  const tokenErr = (status) => {
    const e = new Error(`voice/token ${status}`);
    e.name = "VoiceTokenError";
    e.status = status;
    return e;
  };
  for (const [status, reason] of [[429, "busy"], [503, "service"]]) {
    const { session, calls } = harness({ token: async () => { throw tokenErr(status); } });
    await session.start();
    assert.equal(session.current, "error");
    assert.equal(calls.reasons.at(-1), reason, `Status ${status} → ${reason}`);
    await session.stop();
  }
});

test("Kein Mikrofon ist etwas anderes als kein Recht", async () => {
  const { session } = harness({
    microphone: async () => {
      const e = new Error("weg");
      e.name = "NotFoundError";
      throw e;
    },
  });
  await session.start();
  assert.equal(session.current, "error", "kein Mikrofon ist ein Fehler, keine Ablehnung");
  await session.stop();
});

test("Das Mikrofon wird vor dem Ausweis geholt – sonst fragt der Browser nie", async () => {
  // getUserMedia muss aus der Klick-Geste heraus laufen. Käme der Ausweis
  // (ein Netzaufruf) zuerst, wäre die Geste abgelaufen und Safari/iOS
  // lehnte die Mikrofon-Erlaubnis ohne Abfrage ab.
  const reihenfolge = [];
  const { session } = harness({
    token: async () => { reihenfolge.push("token"); return SECRET; },
    microphone: async () => {
      reihenfolge.push("mic");
      const track = { stop: () => {} };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    },
  });
  await session.start();
  assert.deepEqual(reihenfolge, ["mic", "token"], "erst Mikrofon, dann Ausweis");
  await session.stop();
});
