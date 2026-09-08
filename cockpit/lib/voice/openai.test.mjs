/**
 * Der Sprachanbieter, ohne Netz und ohne Schlüssel.
 *
 * Geprüft wird die eine Zusage, die zählt: Der echte Schlüssel verlässt
 * den Server nicht, und ohne Schlüssel ist der Kanal aus statt halb an.
 *
 * Ausführen:  node --experimental-strip-types --test lib/voice/openai.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const mod = await import("./openai.ts");

function withKey(value, fn) {
  const vorher = process.env.OPENAI_API_KEY;
  if (value === null) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = value;
  try {
    return fn();
  } finally {
    if (vorher === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = vorher;
  }
}

test("Ohne Schlüssel ist der Sprachkanal aus – kein halber Zustand", () => {
  withKey(null, () => assert.equal(mod.voiceConfigured(), false));
  withKey("   ", () => assert.equal(mod.voiceConfigured(), false, "Leerzeichen sind kein Schlüssel"));
  withKey("sk-test", () => assert.equal(mod.voiceConfigured(), true));
});

test("Der Ausweis ist eine Transkriptions-Sitzung – sie kann strukturell nicht antworten", async () => {
  let gesehen = null;
  const echt = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    gesehen = { url: String(url), init };
    return new Response(JSON.stringify({ value: "ek_abc", expires_at: 42 }), { status: 200 });
  };
  try {
    const secret = await withKey("sk-geheim", () => mod.mintListenSecret("de"));
    assert.equal(secret.value, "ek_abc");
    assert.equal(secret.expiresAt, 42);
    assert.equal(secret.sampleRate, 24_000);

    const body = JSON.parse(gesehen.init.body);
    assert.equal(body.session.type, "transcription", "keine Sprache-zu-Sprache-Sitzung");
    assert.equal(body.session.audio.input.transcription.language, "de");
    assert.equal(body.session.audio.input.turn_detection.type, "server_vad");
    assert.match(gesehen.url, /\/realtime\/client_secrets$/);
    assert.equal(gesehen.init.headers.authorization, "Bearer sk-geheim");
  } finally {
    globalThis.fetch = echt;
  }
});

test("Der echte Schlüssel steht nie im Ergebnis", async () => {
  const echt = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ value: "ek_abc", expires_at: 1 }), { status: 200 });
  try {
    const secret = await withKey("sk-streng-geheim", () => mod.mintListenSecret("en"));
    assert.ok(!JSON.stringify(secret).includes("sk-streng-geheim"), "der Schlüssel darf den Server nicht verlassen");
  } finally {
    globalThis.fetch = echt;
  }
});

test("Eine Fehlantwort des Anbieters wird nicht als Ausweis ausgegeben", async () => {
  const echt = globalThis.fetch;
  globalThis.fetch = async () => new Response("nein", { status: 401 });
  try {
    await assert.rejects(() => withKey("sk-test", () => mod.mintListenSecret("de")), /client_secrets 401/);
  } finally {
    globalThis.fetch = echt;
  }
});

test("Der Sprechtext wird gekürzt, statt eine offene Vorlesemaschine zu sein", async () => {
  let body = null;
  const echt = globalThis.fetch;
  globalThis.fetch = async (_u, init) => {
    body = JSON.parse(init.body);
    return new Response(new ArrayBuffer(8), { status: 200 });
  };
  try {
    await withKey("sk-test", () => mod.synthesize("a".repeat(5000), "de"));
    assert.equal(body.input.length, mod.MAX_SPEAK_CHARS);
  } finally {
    globalThis.fetch = echt;
  }
});
