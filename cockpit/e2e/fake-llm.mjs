/**
 * Ein Sprachmodell für die Abnahme – OpenAI-kompatibel, ohne Netz.
 *
 * Die echten Anbieter (NVIDIA, OpenRouter) dürfen im Testlauf nicht
 * aufgerufen werden: Sie kosten Zeit, drosseln und antworten jedes Mal
 * anders. Dieser Server tut so, als wäre er einer von ihnen, und lässt
 * sich in vier Zustände versetzen:
 *
 *   ok           – vernünftige Antworten
 *   fail         – HTTP 500, damit der Rückfallweg sichtbar wird
 *   timeout      – antwortet nie, damit die Frist greift
 *   hallucinate  – erfindet Uhrzeiten, damit die Nachprüfung sie verwirft
 *
 * Umschalten: POST /__mode {"mode":"fail"}.  Aufrufe zählen: GET /__calls.
 * Damit lässt sich auch beweisen, was NICHT passiert ist – etwa dass eine
 * medizinische Frage das Modell nie erreicht.
 *
 * Start:  node e2e/fake-llm.mjs      (Port 3200, oder $PORT)
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 3200);

let mode = "ok";
/** Jeder Aufruf: Aufgabe, Modell, Zeitpunkt – nie der Inhalt. */
const calls = [];

const json = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

/** Die Aufgabe steckt in der ersten Zeile des Systemtexts (prompts.ts). */
function taskOf(messages) {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  if (system.startsWith("[CLASSIFY]")) return "classify";
  if (system.startsWith("[GROUND]")) return "ground";
  return "unknown";
}

function classification(userText) {
  const t = (userText || "").toLowerCase();
  const lang = /[a-z]/.test(t) && /(the|please|when|how|would|appointment|hours)/.test(t) && !/[äöüß]/.test(t) ? "en" : "de";
  let intent = "other";
  if (/(termin|appointment|book|buchen)/.test(t)) intent = "booking";
  else if (/(öffnungszeit|sprechzeit|geöffnet|opening|hours|open)/.test(t)) intent = "hours";
  else if (/(anfahrt|adresse|address|directions|get to)/.test(t)) intent = "directions";
  else if (/(mensch|mitarbeiter|human|someone)/.test(t)) intent = "handover";
  else if (/(rezept|befund|überweisung|prescription|referral)/.test(t)) intent = "forward";
  return { intent, lang, type: null, date: null, time: null, topics: [] };
}

/** Aus den Fakten des Systemtexts einen Satz bauen – ohne etwas zu erfinden. */
function grounded(system) {
  const facts = system
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
  return facts.length ? facts.join(" ") : "Dazu liegen mir keine Angaben vor.";
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/__mode" && req.method === "POST") {
    const body = await readBody(req);
    mode = ["ok", "fail", "timeout", "hallucinate"].includes(body.mode) ? body.mode : "ok";
    return json(res, 200, { mode });
  }
  if (url.pathname === "/__calls") {
    if (req.method === "DELETE") {
      calls.length = 0;
      return json(res, 200, { calls: [] });
    }
    return json(res, 200, { mode, count: calls.length, calls });
  }

  if (!url.pathname.endsWith("/chat/completions")) return json(res, 404, { error: "unbekannt" });

  const body = await readBody(req);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const task = taskOf(messages);
  const auth = req.headers.authorization ?? "";
  calls.push({ task, model: body.model ?? null, bearer: auth.startsWith("Bearer ") ? auth.slice(7, 15) : null, at: Date.now() });

  if (mode === "timeout") return; // Antwort bleibt aus – der Aufrufer bricht ab
  if (mode === "fail") return json(res, 500, { error: { message: "Dienst gerade nicht verfügbar" } });

  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  let content;
  if (task === "classify") {
    content = mode === "hallucinate" ? "Kein JSON, sondern Gerede." : JSON.stringify(classification(user));
  } else if (task === "ground") {
    content = mode === "hallucinate" ? "Wir haben täglich bis 19:30 Uhr geöffnet und bieten kostenlose Parkplätze." : grounded(system);
  } else {
    content = "Unbekannte Aufgabe.";
  }

  return json(res, 200, {
    id: "fake-1",
    model: body.model ?? "fake/one",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
});

server.listen(PORT, () => console.log(`[fake-llm] bereit auf :${PORT} (Modus ${mode})`));
