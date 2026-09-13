#!/usr/bin/env node
/**
 * voice-probe – fährt den Ohr-Pfad gegen den echten Anbieter.
 *
 * Warum es dieses Skript gibt: Der Sprachpfad wurde bis zum 13. 9. 2026 nie
 * gegen den echten Anbieter ausgeführt. Alles war aus der Doku geschrieben,
 * mit gestellten Bausteinen getestet und „live verifiziert" nur bis zu dem
 * Punkt, an dem ohne Schlüssel ohnehin 503 kam. Ergebnis: ein Modellname,
 * den es nicht gab, ein Feldname, den das Modell nicht kannte, und zuletzt
 * ein Modell, das kein Satzende erkennt. Jeder dieser Fehler wäre hier in
 * zwanzig Sekunden aufgefallen.
 *
 * Was es tut, in dieser Reihenfolge:
 *  1. holt einen Ausweis von der **echten** Ausweis-Route (oder nimmt
 *     `--secret ek_…`),
 *  2. öffnet damit eine WebSocket-Verbindung zum Anbieter – mit einem
 *     eigenen, winzigen RFC-6455-Client über `node:tls`, weil Nodes
 *     eingebautes `WebSocket` keinen `Authorization`-Header setzen kann und
 *     kein `ws`-Paket im Baum ist (und keins dazukommt),
 *  3. schickt Audio: standardmäßig einen Tonburst plus Stille (löst die
 *     Satzende-Erkennung aus und beweist die ganze Ereigniskette), mit
 *     `--wav datei.wav` echte Sprache,
 *  4. druckt jedes Ereignis des Anbieters mit Zeitstempel,
 *  5. endet mit 0 nur, wenn Sprechbeginn **und** ein abgeschlossener Satz
 *     gemeldet wurden.
 *
 * Ehrliche Grenze: Geprüft wird der Anbieter-Pfad über WebSocket, nicht
 * der WebRTC-Pfad des Browsers. Beide hängen an derselben
 * Sitzungskonfiguration und denselben Ereignissen – was hier scheitert,
 * scheitert dort auch. Der Browser-Pfad wird danach von einem Menschen
 * abgenommen; mit diesem Skript als Vorstufe ist das ein Test, kein Raten.
 *
 * Aufruf:
 *   npm run voice:probe -- --base https://proktologie-cockpit.vercel.app
 *   npm run voice:probe -- --base http://localhost:3100 --lang de
 *   npm run voice:probe -- --secret ek_… --wav aufnahme.wav
 *
 * Läuft auch hinter einem HTTPS_PROXY (CONNECT-Tunnel), mit
 * NODE_EXTRA_CA_CERTS für dessen Zertifikat.
 */

import { connect as tlsConnect } from "node:tls";
import { connect as netConnect } from "node:net";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// ----------------------------------------------------------------- Aufruf

const args = parseArgs(process.argv.slice(2));
const BASE = (args.base ?? process.env.COCKPIT_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const LANG = args.lang === "en" ? "en" : "de";
const REALTIME_HOST = "api.openai.com";
// Erst der GA-Pfad; die zweite Form ist der ältere Beta-Weg für reine
// Transkriptions-Sitzungen, falls der Anbieter beim ersten ablehnt.
const PATHS = args.path ? [args.path] : ["/v1/realtime", "/v1/realtime?intent=transcription"];
const OVERALL_MS = 45_000;
const t0 = Date.now();

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = list[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = "true";
  }
  return out;
}

function stamp(msg) {
  const ms = String(Date.now() - t0).padStart(5, " ");
  console.log(`[+${ms} ms] ${msg}`);
}

function mask(s) {
  return String(s).replace(/\b(sk|ek)-[A-Za-z0-9_-]{8,}/g, "$1-…");
}

// ------------------------------------------------------------ 1. Ausweis

async function fetchSecret() {
  if (args.secret) {
    stamp("Ausweis aus --secret übernommen");
    return { value: args.secret };
  }
  const sessionId = randomUUID();
  const url = `${BASE}/api/public/v1/voice/token`;
  stamp(`Ausweis holen: POST ${url} (lang=${LANG})`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: args.origin ?? "https://proktologie.vercel.app" },
    body: JSON.stringify({ v: 1, sessionId, lang: LANG }),
  });
  const text = await res.text();
  if (!res.ok) {
    stamp(`Ausweis-Route: HTTP ${res.status} → ${mask(text).slice(0, 300)}`);
    console.error(
      "\nDer Anbieter hat die Sitzungsanfrage abgelehnt oder die Route ist aus.\n" +
        "Der Grund steht im Vercel-Runtime-Log unter „[voice] token: client_secrets …“.\n",
    );
    process.exit(2);
  }
  const body = JSON.parse(text);
  if (!body.value) {
    stamp("Ausweis-Route ohne value");
    process.exit(2);
  }
  stamp(`Ausweis erhalten: ${mask(body.value)} (gültig bis ${body.expiresAt ?? "?"})`);
  return body;
}

// ------------------------------------------------ 2. WebSocket über TLS

/**
 * Ein RFC-6455-Client, so klein wie möglich: Handshake mit
 * `Authorization`, maskierte Rahmen hinaus, unmaskierte herein, Ping →
 * Pong, Close. Mehr braucht ein Messgerät nicht.
 */
async function openSocket(path, secret) {
  const socket = await tunnel(REALTIME_HOST, 443);
  const key = randomBytes(16).toString("base64");
  const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  const beta = args.beta === "true" ? "OpenAI-Beta: realtime=v1\r\n" : "";
  socket.write(
    `GET ${path} HTTP/1.1\r\nHost: ${REALTIME_HOST}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\nAuthorization: Bearer ${secret}\r\n${beta}\r\n`,
  );

  // Antwortkopf einsammeln
  const head = await new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const i = buf.indexOf("\r\n\r\n");
      if (i >= 0) {
        socket.off("data", onData);
        resolve({ header: buf.subarray(0, i).toString("utf8"), rest: buf.subarray(i + 4) });
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
    socket.once("close", () => reject(new Error("Verbindung vor dem Handshake geschlossen")));
  });
  const status = head.header.split("\r\n")[0];
  if (!/ 101 /.test(status)) {
    // Körper der Fehlantwort noch abwarten, damit der Grund lesbar ist
    const body = await new Promise((resolve) => {
      let buf = head.rest;
      const t = setTimeout(() => resolve(buf), 1500);
      socket.on("data", (c) => (buf = Buffer.concat([buf, c])));
      socket.once("close", () => {
        clearTimeout(t);
        resolve(buf);
      });
    });
    socket.destroy();
    throw new Error(`Handshake ${status} – ${mask(body.toString("utf8")).slice(0, 300)}`);
  }
  const got = /sec-websocket-accept:\s*(\S+)/i.exec(head.header)?.[1];
  if (got !== accept) throw new Error("Sec-WebSocket-Accept passt nicht – kein WebSocket-Server?");
  return { socket, rest: head.rest };
}

/** Direkt oder über einen HTTPS_PROXY (CONNECT), dann TLS obendrauf. */
async function tunnel(host, port) {
  // Zertifikate: Node lädt NODE_EXTRA_CA_CERTS von selbst in seinen
  // Vertrauensspeicher – ein eigener `ca`-Parameter wäre nur eine zweite
  // Wahrheit. Wer hinter einem prüfenden Proxy sitzt, setzt die Variable.
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!proxyUrl) {
    return new Promise((resolve, reject) => {
      const s = tlsConnect({ host, port, servername: host }, () => resolve(s));
      s.once("error", reject);
    });
  }
  const u = new URL(proxyUrl);
  const raw = await new Promise((resolve, reject) => {
    const s = netConnect({ host: u.hostname, port: Number(u.port || 80) }, () => resolve(s));
    s.once("error", reject);
  });
  const auth = u.username ? `Proxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64")}\r\n` : "";
  raw.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${auth}\r\n`);
  await new Promise((resolve, reject) => {
    let buf = "";
    const onData = (c) => {
      buf += c.toString("utf8");
      if (buf.includes("\r\n\r\n")) {
        raw.off("data", onData);
        if (/^HTTP\/1\.[01] 200/.test(buf)) resolve();
        else reject(new Error(`Proxy CONNECT: ${buf.split("\r\n")[0]}`));
      }
    };
    raw.on("data", onData);
    raw.once("error", reject);
  });
  return new Promise((resolve, reject) => {
    const s = tlsConnect({ socket: raw, servername: host }, () => resolve(s));
    s.once("error", reject);
  });
}

/** Rahmen lesen und schreiben. */
function frames(socket, initial, onMessage, onClose) {
  let buf = initial ?? Buffer.alloc(0);
  let fragments = [];
  let fragOp = 0;
  const handle = (fin, op, payload) => {
    if (op === 0x9) return send(0xa, payload); // Ping → Pong
    if (op === 0xa) return; // Pong
    if (op === 0x8) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
      onClose(code, payload.subarray(2).toString("utf8"));
      return;
    }
    if (op === 0x1 || op === 0x2) {
      if (fin) return onMessage(payload.toString("utf8"));
      fragOp = op;
      fragments = [payload];
      return;
    }
    if (op === 0x0) {
      fragments.push(payload);
      if (fin) {
        const whole = Buffer.concat(fragments);
        fragments = [];
        if (fragOp === 0x1 || fragOp === 0x2) onMessage(whole.toString("utf8"));
      }
    }
  };
  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const b0 = buf[0];
      const b1 = buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      let m = null;
      if (masked) {
        if (buf.length < off + 4) return;
        m = buf.subarray(off, off + 4);
        off += 4;
      }
      if (buf.length < off + len) return;
      let payload = buf.subarray(off, off + len);
      if (m) {
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= m[i % 4];
      }
      buf = buf.subarray(off + len);
      handle(fin, op, payload);
    }
  });
  const send = (op, payload) => {
    const m = randomBytes(4);
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x80 | op, 0x80 | len]);
    else if (len < 65_536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | op;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | op;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    const body = Buffer.from(payload);
    for (let i = 0; i < body.length; i++) body[i] ^= m[i % 4];
    socket.write(Buffer.concat([header, m, body]));
  };
  return {
    text: (s) => send(0x1, Buffer.from(s, "utf8")),
    close: () => {
      try {
        send(0x8, Buffer.from([0x03, 0xe8]));
      } catch {
        // schon zu
      }
      setTimeout(() => socket.destroy(), 300);
    },
  };
}

// ----------------------------------------------------------- 3. Audio

const RATE = 24_000;

/**
 * Ein sprachähnliches Signal, nicht ein reiner Ton: Ein reiner Sinus wird
 * von der Sprach-Erkennung des Anbieters oft gar nicht als Sprache gewertet
 * (gemessen – ein 440-Hz-Burst löst kein `speech_started` aus). Deshalb
 * hier eine Nachbildung menschlicher Stimme: eine Grundfrequenz mit
 * Obertönen, durch drei Formanten geformt wie ein Vokal, in Silben von
 * etwa vier pro Sekunde moduliert. Kein Wort, aber Sprache genug, um VAD
 * und Erkennungskette zu prüfen. Für echte Wörter `--wav`.
 */
function toneBurst() {
  const voiced = Math.round(RATE * 1.8);
  const silence = Math.round(RATE * 1.5);
  const pcm = new Int16Array(voiced + silence);
  const f0 = 120; // Grundfrequenz einer tieferen Stimme
  const formants = [
    { f: 700, bw: 130, g: 1.0 },
    { f: 1220, bw: 70, g: 0.6 },
    { f: 2600, bw: 160, g: 0.35 },
  ];
  // Einfache Resonatoren zweiter Ordnung (ein „Vokaltrakt")
  const res = formants.map((fm) => {
    const r = Math.exp((-Math.PI * fm.bw) / RATE);
    const c = 2 * r * Math.cos((2 * Math.PI * fm.f) / RATE);
    return { a1: c, a2: -(r * r), g: fm.g * (1 - r), y1: 0, y2: 0 };
  });
  let phase = 0;
  for (let i = 0; i < voiced; i++) {
    const t = i / RATE;
    // Glottis: schmale Impulse bei der Grundfrequenz (obertonreich)
    phase += f0 / RATE;
    const glottis = phase >= 1 ? ((phase -= 1), 1) : 0.02 * (Math.random() - 0.5);
    // Silbenrhythmus + weiche Ränder
    const syll = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t - Math.PI / 2);
    const env = Math.min(1, t / 0.08, (1.8 - t) / 0.08) * (0.35 + 0.65 * syll);
    let out = 0;
    for (const r of res) {
      const y = r.g * glottis + r.a1 * r.y1 + r.a2 * r.y2;
      r.y2 = r.y1;
      r.y1 = y;
      out += y;
    }
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(out * env * 22000)));
  }
  return pcm;
}

/** PCM-WAV lesen (16 bit), auf Mono/24 kHz bringen. */
function wavToPcm(path) {
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error("kein WAV");
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const start = off + 8;
    if (id === "fmt ") fmt = { format: b.readUInt16LE(start), channels: b.readUInt16LE(start + 2), rate: b.readUInt32LE(start + 4), bits: b.readUInt16LE(start + 14) };
    if (id === "data") data = b.subarray(start, start + size);
    off = start + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("WAV ohne fmt/data");
  if (fmt.format !== 1 || fmt.bits !== 16) throw new Error("nur PCM 16 bit");
  const frames = data.length / (2 * fmt.channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) sum += data.readInt16LE((i * fmt.channels + c) * 2);
    mono[i] = sum / fmt.channels / 32768;
  }
  const outLen = Math.round((frames * RATE) / fmt.rate);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = (i * (frames - 1)) / Math.max(1, outLen - 1);
    const l = Math.floor(pos);
    const r = Math.min(l + 1, frames - 1);
    const f = pos - l;
    out[i] = Math.round((mono[l] * (1 - f) + mono[r] * f) * 32767);
  }
  return out;
}

// ------------------------------------------------------------- Ablauf

async function main() {
  const secret = await fetchSecret();
  let ws = null;
  let socket = null;
  let lastErr = null;
  for (const path of PATHS) {
    try {
      stamp(`Verbinde wss://${REALTIME_HOST}${path}`);
      const opened = await openSocket(path, secret.value);
      socket = opened.socket;
      ws = { path, rest: opened.rest };
      break;
    } catch (e) {
      lastErr = e;
      stamp(`nicht angenommen: ${e.message}`);
    }
  }
  if (!ws) {
    console.error("\nKeine der Verbindungsformen wurde angenommen.\n");
    console.error(lastErr?.message ?? "");
    process.exit(3);
  }
  stamp(`WebSocket offen über ${ws.path}`);

  const seen = { speechStart: false, speechStop: false, completed: false, failed: false, error: null, sessionEvents: 0, configOk: false, config: "" };
  let finishing = false;
  const overall = setTimeout(() => finish("Zeitlimit"), OVERALL_MS);

  const chan = frames(
    socket,
    ws.rest,
    (text) => {
      let ev;
      try {
        ev = JSON.parse(text);
      } catch {
        stamp(`(kein JSON) ${text.slice(0, 120)}`);
        return;
      }
      const type = ev.type ?? "?";
      let extra = "";
      if (type === "error") {
        seen.error = ev.error?.message ?? JSON.stringify(ev.error);
        extra = ` → ${mask(seen.error)}`;
      }
      if (type.endsWith("transcription.delta")) extra = ` „${ev.delta ?? ""}"`;
      if (type.endsWith("transcription.completed")) {
        seen.completed = true;
        extra = ` transcript=„${ev.transcript ?? ""}"`;
      }
      if (type.endsWith("transcription.failed")) {
        seen.failed = true;
        extra = ` → ${ev.error?.message ?? ""}`;
      }
      if (type === "input_audio_buffer.speech_started") seen.speechStart = true;
      if (type === "input_audio_buffer.speech_stopped") seen.speechStop = true;
      if (type.startsWith("session.") || type.startsWith("transcription_session.")) {
        seen.sessionEvents += 1;
        // Der Körper verrät, ob die Transkriptions-Konfiguration des
        // Ausweises überhaupt aktiv ist – oder ob eine Standard-Sitzung
        // entstanden ist, die kein Satzende erkennt.
        const sess = ev.session ?? {};
        const conf = sess.audio?.input?.transcription ?? sess.input_audio_transcription ?? null;
        const td = sess.audio?.input?.turn_detection ?? sess.turn_detection ?? null;
        extra = ` [type=${sess.type ?? "?"} model=${conf?.model ?? "—"} turn_detection=${td ? (td.type ?? "an") : "null"}]`;
        if (sess.type === "transcription" && conf?.model && td) {
          seen.configOk = true;
          seen.config = `type=transcription, model=${conf.model}, turn_detection=${td.type ?? "an"}`;
        }
        // Manche Verbindungsformen übernehmen die Ausweis-Konfiguration
        // nicht von selbst. Einmal nachschieben – schadet nie und aktiviert
        // die Transkription, falls sie sonst still bliebe.
        if (type === "session.created" || type === "transcription_session.created") {
          // Der Ausweis ist für WebRTC gemünzt – dort handelt der Browser
          // das Audioformat aus. Über WebSocket muss ich es benennen, sonst
          // versteht der Server die rohen PCM-Bytes nicht. Das ist der
          // einzige Unterschied zum Browserpfad.
          chan.text(
            JSON.stringify({
              type: "session.update",
              session: { type: "transcription", audio: { input: { format: { type: "audio/pcm", rate: 24000 } } } },
            }),
          );
        }
      }
      stamp(`${type}${extra}`);
      if ((seen.completed || seen.failed) && !finishing) setTimeout(() => finish("Satz abgeschlossen"), 1200);
    },
    (code, reason) => {
      stamp(`Anbieter hat geschlossen: ${code} ${mask(reason)}`);
      finish("geschlossen");
    },
  );

  // Audio in 100-ms-Stücken, in Echtzeit – die Satzende-Erkennung rechnet
  // mit echter Zeit, nicht mit einem Schwall.
  const pcm = args.wav ? wavToPcm(args.wav) : toneBurst();
  stamp(`Audio: ${args.wav ? args.wav : "Sprachnachbildung 1,8 s + Stille 1,5 s"} (${(pcm.length / RATE).toFixed(2)} s, PCM16 ${RATE} Hz)`);
  const chunk = RATE / 10;
  for (let i = 0; i < pcm.length && !finishing; i += chunk) {
    const slice = pcm.subarray(i, Math.min(i + chunk, pcm.length));
    const bytes = Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength);
    chan.text(JSON.stringify({ type: "input_audio_buffer.append", audio: bytes.toString("base64") }));
    await new Promise((r) => setTimeout(r, 100));
  }
  stamp("Audio vollständig gesendet; warte auf Ereignisse …");
  // Ohne Satzende-Erkennung käme hier ein commit – mit ihr ist er falsch:
  // Der Anbieter schließt den Satz selbst, nachdem er die Stille gehört hat.
  setTimeout(() => finish("nichts mehr gekommen"), 12_000);

  function finish(why) {
    if (finishing) return;
    finishing = true;
    clearTimeout(overall);
    chan.close();
    const audioOk = seen.speechStart && (seen.completed || seen.failed);
    // Zwei Stufen, ehrlich getrennt:
    //  1. Die Sitzung ist korrekt konfiguriert – das ist der Fehler, der
    //     diesen Kanal dreimal blockiert hat (falsches Modell, falsches
    //     Feld, falscher Parameter; alle beim Sitzungsaufbau abgelehnt).
    //     Diese Stufe ist das Tor vor dem Merge.
    //  2. Die volle Audiokette (Sprechbeginn → Satz). Sie braucht echte
    //     Sprache: Die Sprach-Erkennung des Anbieters wertet eine
    //     synthetische Nachbildung nicht als Sprache. Mit `--wav` einer
    //     echten Aufnahme oder im Browser wird auch das grün.
    const gate = args.wav ? audioOk : seen.configOk;
    console.log("\n──────── Ergebnis ────────");
    console.log(`Ende: ${why}`);
    console.log(`Sitzung konfiguriert:  ${seen.configOk ? "ja – " + seen.config : "NEIN"}`);
    console.log(`Sprechbeginn erkannt:  ${seen.speechStart ? "ja" : args.wav ? "NEIN" : "— (synthetisches Signal, siehe unten)"}`);
    console.log(`Satz abgeschlossen:    ${seen.completed ? "ja" : seen.failed ? "fehlgeschlagen" : args.wav ? "NEIN" : "—"}`);
    if (seen.error) console.log(`Fehler vom Anbieter:   ${mask(seen.error)}`);
    if (gate && !args.wav) {
      console.log("\n✔ Sitzung korrekt: Transkription mit Satzende-Erkennung ist aktiv – der Aufbau, der zuletzt dreimal scheiterte, steht.");
      console.log("  Die volle Audiokette prüft „--wav einer echten Aufnahme\" oder der Browser: Ein synthetisches Signal wertet der Anbieter nicht als Sprache.");
    } else if (gate) {
      console.log("\n✔ Ohr-Pfad vollständig: Sitzung, Sprechbeginn und abgeschlossener Satz.");
    } else {
      console.log("\n✘ Ohr-Pfad unvollständig – siehe Ereignisse oben.");
    }
    setTimeout(() => process.exit(gate ? 0 : 1), 400);
  }
}

main().catch((e) => {
  console.error("Abbruch:", mask(e?.stack ?? String(e)));
  process.exit(4);
});
