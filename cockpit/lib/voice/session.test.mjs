/**
 * Das ganze Sprachgespräch, von Audio bis Antwort – mit einem gestellten
 * Anbieter und einem gestellten Automaten, also ohne Schlüssel, ohne Netz
 * und ohne dass ein Ton den Rechner verlässt.
 *
 * Geprüft wird vor allem, was am Telefon schiefgehen kann und keinen
 * Fehler ins Protokoll schreibt: dass der Assistent verstummt, wenn
 * jemand spricht; dass ein Nebengespräch nicht beim Automaten landet;
 * dass ein Ausfall nicht in Stille endet; dass eine Grenze gesprochen
 * wird statt einfach zuzuschlagen.
 *
 * Ausführen:  node --test lib/voice/session.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { VoiceSession, readStage } = await import("./session.ts");
const { FakeSpeechProvider, tone, room } = await import("./fake-provider.ts");

const KNOWN = /(termin|buchen|öffnungszeit|sprechzeit|anfahrt|adresse|dienstag|montag|uhr|vormittag|nachmittag|ja|nein)/iu;
const NOTFALL = /(brustschmerz|keine luft|bewusstlos|herzinfarkt|schlaganfall)/iu;

/** Ein Automat, der Antworten aus einer Liste gibt und jeden Aufruf notiert. */
function fakeChat(replies = []) {
  const calls = [];
  let i = 0;
  const chat = async (body) => {
    calls.push(body);
    const r = replies[Math.min(i, replies.length - 1)] ?? {};
    i += 1;
    return {
      reply: r.reply ?? "Gern. Worum geht es bei dem Termin?",
      lang: r.lang ?? "de",
      state: r.state ?? { v: 1, stage: r.stage ?? "type" },
      quick: r.quick,
      flags: r.flags,
    };
  };
  return { chat, calls };
}

function build({ script = [], replies = [], mode = "ok", options = {} } = {}) {
  const provider = new FakeSpeechProvider({ script, mode });
  const { chat, calls } = fakeChat(replies);
  const out = [];
  const audit = [];
  let clock = 0;
  const session = new VoiceSession(
    {
      provider,
      chat,
      now: () => (clock += 1),
      audit: (event, data) => audit.push([event, data]),
      hasIntent: (t) => KNOWN.test(t),
      isEmergency: (t) => NOTFALL.test(t),
    },
    { sessionId: "11111111-2222-4333-8444-555555555555", channel: "phone", ...options },
    (o) => out.push(o),
  );
  return { session, provider, calls, out, audit };
}

/** Eine gesprochene Äußerung ins Mikrofon geben. */
function speak(session, { voiced = 40, before = 20, after = 40, amplitude = 0.3 } = {}) {
  for (let i = 0; i < before; i++) session.feed(room());
  for (let i = 0; i < voiced; i++) session.feed(tone(220, amplitude));
  for (let i = 0; i < after; i++) session.feed(room());
}

const settle = () => new Promise((r) => setTimeout(r, 5));

// ------------------------------------------------------------ Grundfall

test("Ein Satz geht an den Automaten, seine Antwort wird gesprochen", async () => {
  const { session, calls, out } = build({
    script: ["Ich hätte gern einen Termin"],
    replies: [{ reply: "Gern. Worum geht es bei dem Termin?", stage: "type" }],
  });
  await session.start();
  speak(session);
  await settle();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].message, "Ich hätte gern einen Termin");
  assert.equal(calls[0].state, null, "das erste Mal ohne Zustand");
  const gesagt = out.filter((o) => o.kind === "say");
  assert.equal(gesagt.length, 1);
  assert.match(gesagt[0].text, /Worum geht es/);
  assert.ok(out.some((o) => o.kind === "audio"), "es kommt auch wirklich Ton");
  assert.ok(out.some((o) => o.kind === "spoken"), "und er wird zu Ende gesprochen");
});

test("Der Zustand des Automaten wird unverändert weitergetragen", async () => {
  const zustand = { v: 1, stage: "date", draft: { typeId: "kontrolle" } };
  const { session, calls } = build({
    script: ["Termin bitte", "Am Dienstag"],
    replies: [{ reply: "Für welchen Tag?", state: zustand }, { reply: "Am Dienstag ist frei.", state: { v: 1, stage: "time" } }],
  });
  await session.start();
  speak(session);
  await settle();
  speak(session);
  await settle();

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].state, zustand, "unverändert zurückgegeben, nicht neu gebaut");
  assert.equal(session.state.stage, "time");
});

test("Angebotene Schaltflächen werden zu einem gesprochenen Satz", async () => {
  const { session, out } = build({
    script: ["Ich hätte gern einen Termin"],
    replies: [{ reply: "Gern.", quick: [{ id: "book", label: "Termin vereinbaren" }, { id: "hours", label: "Öffnungszeiten" }] }],
  });
  await session.start();
  speak(session);
  await settle();
  const gesagt = out.find((o) => o.kind === "say");
  assert.match(gesagt.text, /Sagen Sie einfach: Termin vereinbaren oder Öffnungszeiten\./);
});

test("Die Antwort wird in gesprochene Form gebracht, nicht roh vorgelesen", async () => {
  const { session, out } = build({
    script: ["Wann haben Sie geöffnet"],
    replies: [{ reply: "Sprechzeiten: Mo, Mi, Fr 07:00–12:00. Rufen Sie an: 040 490 80 21 – oder nutzen Sie die Schaltflächen unten." }],
  });
  await session.start();
  speak(session);
  await settle();
  const gesagt = out.find((o) => o.kind === "say");
  assert.match(gesagt.text, /von sieben Uhr bis zwölf Uhr/);
  assert.match(gesagt.text, /null vier null/);
  assert.ok(!/Schaltflächen/.test(gesagt.text), gesagt.text);
});

// ------------------------------------------------------- Unterbrechen

test("Spricht der Patient während der Antwort, bricht die Ausgabe sofort ab", async () => {
  // Der gestellte Anbieter gibt seinen Ton stückweise aus. Zwischen zwei
  // Stücken schiebt der Test echtes Sprachaudio ins Mikrofon – das ist
  // genau die Lage, in der ein Patient dazwischenredet.
  let session;
  let injected = false;
  const provider = new FakeSpeechProvider({
    script: ["Ich hätte gern einen Termin", "nein, doch nicht"],
    latencyMs: 1,
    sleep: async () => {
      if (injected || !session) return;
      injected = true;
      for (let i = 0; i < 8; i++) session.feed(tone(220, 0.5));
    },
  });
  const { chat } = fakeChat([{ reply: "Ein sehr langer Antwortsatz, der lange genug dauert, um unterbrochen zu werden." }]);
  const out = [];
  const audit = [];
  let clock = 0;
  session = new VoiceSession(
    {
      provider,
      chat,
      now: () => (clock += 1),
      audit: (e, d) => audit.push([e, d]),
      hasIntent: (t) => KNOWN.test(t),
      isEmergency: () => false,
    },
    { sessionId: "11111111-2222-4333-8444-555555555555" },
    (o) => out.push(o),
  );
  await session.start();
  speak(session);
  await settle();

  assert.ok(out.some((o) => o.kind === "stop" && o.reason === "barge_in"), `keine Unterbrechung: ${out.map((o) => o.kind).join(",")}`);
  assert.ok(audit.some(([e]) => e === "voice.barge_in"));
  assert.ok(!out.some((o) => o.kind === "spoken"), "der unterbrochene Satz gilt nicht als zu Ende gesprochen");
  assert.ok(provider.aborted >= 1, "die Sprachausgabe wurde tatsächlich abgebrochen");
});

// ------------------------------------------------------ Nebengespräch

test("Ein Nebengespräch erreicht den Automaten nie – nachweislich kein Aufruf", async () => {
  const { session, calls, audit } = build({ script: ["sag mal, wo ist der Kalender"] });
  await session.start();
  speak(session);
  await settle();

  assert.deepEqual(calls, [], "kein einziger Aufruf");
  assert.ok(audit.some(([e, d]) => e === "voice.ignored" && d?.reason === "not_addressed"));
});

test("Das Protokoll eines Nebengesprächs enthält keinen Wortlaut", async () => {
  const { session, audit } = build({ script: ["Schatz, wo ist meine Brille"] });
  await session.start();
  speak(session);
  await settle();
  const zeile = audit.find(([e]) => e === "voice.ignored");
  assert.ok(zeile);
  assert.ok(!JSON.stringify(zeile).includes("Brille"), JSON.stringify(zeile));
});

test("Ein Notfall geht durch, auch leise und mitten in der Ausgabe", async () => {
  const { session, calls } = build({
    script: ["ich habe starke Brustschmerzen"],
    replies: [{ reply: "Das klingt nach einem Notfall. Bitte rufen Sie sofort den Notruf 112 an.", flags: { emergency: true } }],
  });
  await session.start();
  speak(session, { amplitude: 0.02 });
  await settle();
  assert.equal(calls.length, 1, "der Notfall muss immer beim Automaten ankommen");
});

test("Der Notrufsatz wird als Ziffern gesprochen", async () => {
  const { session, out } = build({
    script: ["ich bekomme keine Luft"],
    replies: [{ reply: "Bitte rufen Sie sofort den Notruf 112 an. Bereitschaftsdienst 116 117." }],
  });
  await session.start();
  speak(session);
  await settle();
  const gesagt = out.find((o) => o.kind === "say");
  assert.match(gesagt.text, /eins eins zwei/);
  assert.match(gesagt.text, /eins eins sechs eins eins sieben/);
  assert.ok(!/\b112\b/.test(gesagt.text), gesagt.text);
});

// -------------------------------------------------------------- Ausfall

test("Fällt der Automat aus, endet das Gespräch nicht in Stille", async () => {
  const provider = new FakeSpeechProvider({ script: ["Termin bitte"] });
  const out = [];
  const audit = [];
  let clock = 0;
  const session = new VoiceSession(
    {
      provider,
      chat: async () => {
        throw new Error("Netz weg");
      },
      now: () => (clock += 1),
      audit: (e, d) => audit.push([e, d]),
      hasIntent: (t) => KNOWN.test(t),
      isEmergency: () => false,
    },
    { sessionId: "11111111-2222-4333-8444-555555555555" },
    (o) => out.push(o),
  );
  await session.start();
  speak(session);
  await settle();

  assert.ok(out.some((o) => o.kind === "say"), "der Anrufer hört einen Satz");
  const uebergabe = out.find((o) => o.kind === "handover");
  assert.ok(uebergabe, "und wird an das Team übergeben");
  assert.ok(audit.some(([e]) => e === "voice.chat_failed"));
  assert.ok(out.some((o) => o.kind === "end"));
});

test("Liefert die Sprachausgabe nichts, bricht das Gespräch trotzdem nicht ab", async () => {
  const { session, out } = build({ script: ["Termin bitte"], mode: "mute", replies: [{ reply: "Gern." }] });
  await session.start();
  speak(session);
  await settle();
  assert.ok(out.some((o) => o.kind === "say"), "der Satz wird angekündigt");
  assert.ok(out.some((o) => o.kind === "spoken"), "und als gesprochen abgeschlossen");
  assert.equal(out.filter((o) => o.kind === "audio").length, 0, "nur eben ohne Ton");
});

// ------------------------------------------------------------- Grenzen

test("Eine überschrittene Grenze wird gesagt, nicht stillschweigend vollzogen", async () => {
  const { session, out, audit } = build({
    script: ["Termin bitte"],
    replies: [{ reply: "Gern." }],
    options: { limits: { maxSessionMs: 1e9, maxSttSeconds: 0.1, maxTtsChars: 1e9, maxTurns: 99 } },
  });
  await session.start();
  speak(session);
  await settle();

  assert.ok(audit.some(([e, d]) => e === "voice.limit" && d?.limit === "stt_seconds"));
  const gesagt = out.filter((o) => o.kind === "say");
  assert.ok(gesagt.length > 0);
  assert.match(gesagt.at(-1).text, /null vier null vier neun null acht null zwei eins/, "die Nummer wird genannt");
  assert.ok(out.some((o) => o.kind === "end"));
});

test("Nur eingespeistes Audio zählt – Stille kostet nichts", async () => {
  const { session } = build({ script: [] });
  await session.start();
  for (let i = 0; i < 50; i++) session.feed(room());
  assert.ok(Math.abs(session.usage.sttSeconds - 1) < 0.01, String(session.usage.sttSeconds));
  const vorher = session.usage.sttSeconds;
  await session.close();
  for (let i = 0; i < 50; i++) session.feed(room());
  assert.equal(session.usage.sttSeconds, vorher, "nach dem Ende wird nichts mehr gezählt");
});

// ------------------------------------------------------------ Übergabe

test("Verlangt der Automat eine Übergabe, wird sie ausgeführt", async () => {
  const { session, out } = build({
    script: ["Ich möchte mit einem Menschen sprechen"],
    replies: [{ reply: "Gern verbinde ich Sie mit dem Team.", flags: { handover: true } }],
  });
  await session.start();
  speak(session);
  await settle();
  assert.ok(out.some((o) => o.kind === "handover"));
  assert.ok(out.some((o) => o.kind === "end"));
});

// ---------------------------------------------------------- Kleinigkeit

test("Eine unbekannte Stufe gilt als idle – daraus wird nie gebucht", () => {
  assert.equal(readStage(null), "idle");
  assert.equal(readStage({ stage: "erfunden" }), "idle");
  assert.equal(readStage({ stage: "confirm" }), "confirm");
  assert.equal(readStage("kein Objekt"), "idle");
});
