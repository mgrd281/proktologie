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
  assert.equal(stt, "gpt-transcribe", "das Modell mit Satzende-Erkennung – gpt-live-transcribe hat keine (gemessen: 400)");
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

test("Die Pause vor dem Satzende ist länger als der Auslieferungswert", async () => {
  // `server_vad` misst nur Stille und schneidet damit genau die Patientin
  // ab, die langsam spricht. `semantic_vad` wäre die Antwort darauf, ist
  // für Transkriptions-Sitzungen aber widersprüchlich dokumentiert – also
  // dieselbe Absicht über ein Feld, das sicher unterstützt wird.
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
  assert.equal(input.turn_detection.type, "server_vad");
  assert.ok(input.turn_detection.silence_duration_ms >= 1000, "mehr Luft als die 700 ms des Anbieters");
});

test("Die Sitzungsanfrage trägt keinen Personenbezug und kein WebSocket-Format", async () => {
  // Über WebRTC handelt der Browser das Audio aus; `format` gilt für
  // WebSocket. Und der Rahmen fürs Modell darf nur enthalten, was auch auf
  // dem Praxisschild steht – nie etwas aus einem Gespräch.
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
  assert.equal("format" in input, false, "kein format über WebRTC");
  assert.equal(input.noise_reduction.type, "near_field");
  assert.equal(input.transcription.delay, "low");
  assert.match(input.transcription.prompt, /Praxis/);
  assert.doesNotMatch(input.transcription.prompt, /@|\d{3,}/, "keine Adresse, keine Nummer");
  assert.ok(Array.isArray(input.transcription.keywords) && input.transcription.keywords.includes("Termin"));
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

test("Eine echte, lange Anbieter-Fehlermeldung bleibt lesbar", async () => {
  // Der teuerste Fehler dieser Datei war, vor dem Auswerten zu kürzen: Eine
  // echte 401-Antwort von OpenAI ist mit maskiertem Schlüssel und Hilfe-Link
  // rund 320 Zeichen lang. Nach einem Schnitt bei 300 wäre das JSON kaputt –
  // und der Betreiber läse „keine lesbare Antwort" ausgerechnet dann, wenn
  // sein Schlüssel falsch ist.
  const koerper = JSON.stringify(
    {
      error: {
        message:
          "Incorrect API key provided: sk-proj-**********************************************************************************. You can find your API key at https://platform.openai.com/account/api-keys.",
        type: "invalid_request_error",
        param: null,
        code: "invalid_api_key",
      },
    },
    null,
    2,
  );
  assert.ok(koerper.length > 300, "der Fall ist nur echt, wenn der Körper wirklich länger ist");
  const echt = globalThis.fetch;
  globalThis.fetch = async () => new Response(koerper, { status: 401 });
  try {
    await assert.rejects(
      () => withKey("sk-falsch", () => mod.mintListenSecret("de")),
      /client_secrets 401: Incorrect API key provided/,
    );
  } finally {
    globalThis.fetch = echt;
  }
});

test("Ein zurückgespiegelter Schlüssel verlässt die Datei unkenntlich", async () => {
  const echt = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Bad key sk-livegeheim1234567890abcdef used" } }), { status: 401 });
  try {
    await withKey("sk-test", () => mod.synthesize("Hallo", "de"));
    assert.fail("hätte werfen müssen");
  } catch (error) {
    assert.match(error.message, /sk-…/);
    assert.doesNotMatch(error.message, /livegeheim/, "kein Schlüssel im Protokoll");
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
