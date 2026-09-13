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
    assert.deepEqual(body.session.audio.input.transcription.languages, ["de"]);
    assert.equal(body.session.audio.input.turn_detection.type, "semantic_vad");
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

test("Die Modellnamen sind die, die es wirklich gibt", async () => {
  // Ein erfundener Modellname kostet den Betreiber einen Abend: Der Knopf
  // erscheint, das Mikrofon geht auf, und der Anbieter antwortet mit 400.
  let stt = null;
  let tts = null;
  const echt = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).includes("client_secrets")) {
      stt = body.session.audio.input.transcription.model;
      return new Response(JSON.stringify({ value: "ek_a", expires_at: 1 }), { status: 200 });
    }
    tts = body.model;
    return new Response(new ArrayBuffer(4), { status: 200 });
  };
  try {
    await withKey("sk-test", () => mod.mintListenSecret("de"));
    await withKey("sk-test", () => mod.synthesize("Hallo", "de"));
  } finally {
    globalThis.fetch = echt;
  }
  assert.equal(stt, "gpt-live-transcribe", "das von OpenAI empfohlene Echtzeit-Modell");
  assert.equal(tts, "gpt-4o-mini-tts", "nur dieses Modell kennt instructions");
});

test("Die Sprache steht als Liste im Ausweis, nicht als Einzelwert", async () => {
  // Das Zuhör-Modell kennt nur `languages`; beide Felder zusammen sind
  // ausdrücklich verboten. Ein falscher Name hier heißt nicht „etwas
  // schlechter", sondern 400 – der Knopf erscheint und verbindet nie.
  let input = null;
  const echt = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    input = JSON.parse(init.body).session.audio.input;
    return new Response(JSON.stringify({ value: "ek_a", expires_at: 1 }), { status: 200 });
  };
  try {
    await withKey("sk-test", () => mod.mintListenSecret("en"));
  } finally {
    globalThis.fetch = echt;
  }
  assert.deepEqual(input.transcription.languages, ["en"]);
  assert.equal("language" in input.transcription, false, "beide zusammen sind verboten");
});

test("Das Satzende wird am Inhalt erkannt, nicht an der Stille", async () => {
  // `server_vad` misst nur Stille und schneidet damit genau die Patientin
  // ab, die langsam spricht. Deshalb die geduldigste Stufe.
  let input = null;
  const echt = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    input = JSON.parse(init.body).session.audio.input;
    return new Response(JSON.stringify({ value: "ek_a", expires_at: 1 }), { status: 200 });
  };
  try {
    await withKey("sk-test", () => mod.mintListenSecret("de"));
  } finally {
    globalThis.fetch = echt;
  }
  assert.equal(input.turn_detection.type, "semantic_vad");
  assert.equal(input.turn_detection.eagerness, "low");
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

test("Eine Fehlantwort des Anbieters wird lesbar gemacht, statt als nackte Zahl zu enden", async () => {
  // Ohne den Grund steht im Vercel-Protokoll nur „502" – und der Betreiber
  // sucht einen Abend, obwohl der Anbieter „unknown model" geantwortet hat.
  const echt = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Unknown model: gpt-erfunden" } }), { status: 400 });
  try {
    await assert.rejects(
      () => withKey("sk-test", () => mod.mintListenSecret("de")),
      /client_secrets 400: Unknown model: gpt-erfunden/,
    );
  } finally {
    globalThis.fetch = echt;
  }
});

test("Auch eine unlesbare Fehlantwort bringt den Aufruf nicht zum Absturz", async () => {
  const echt = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>502</html>", { status: 502 });
  try {
    await assert.rejects(() => withKey("sk-test", () => mod.synthesize("Hallo", "de")), /audio\/speech 502/);
  } finally {
    globalThis.fetch = echt;
  }
});
