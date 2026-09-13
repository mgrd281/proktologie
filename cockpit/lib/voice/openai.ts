/**
 * Der Sprachanbieter – Ohren und Mund, sonst nichts.
 *
 * Zwei Wege zu OpenAI, und beide halten dieselbe Regel ein: **Der
 * Schlüssel verlässt niemals den Server.**
 *
 *  - **Ohren.** Der Browser spricht direkt mit OpenAI, über WebRTC. Dafür
 *    braucht er einen Ausweis, keinen Schlüssel: Diese Datei tauscht den
 *    echten Schlüssel gegen ein kurzlebiges Geheimnis (`ek_…`), das nach
 *    Minuten verfällt und nur für eine einzige Sitzung gilt. Klaut es
 *    jemand aus dem Browser, hat er ein Stück Papier, das schon abgelaufen
 *    ist.
 *  - **Mund.** Der fertige Antwortsatz geht von hier an die
 *    Sprachausgabe und kommt als Audio zurück. Auch hier sieht der Browser
 *    nur Töne, nie den Schlüssel.
 *
 * Warum eine reine Transkriptions-Sitzung und nicht die Sprache-zu-Sprache-
 * Variante: Eine Transkriptions-Sitzung **kann strukturell nicht
 * antworten**. Sie liefert Text, weiter nichts. Damit ist bewiesen, nicht
 * nur versprochen, dass die Antwort aus unserem Automaten kommt – mit
 * Notfallpfad, Gesundheitsfilter und echter Verfügbarkeit. Ein Modell, das
 * selbst reden dürfte, könnte einen Termin erfinden.
 *
 * Ohne `OPENAI_API_KEY` ist der ganze Sprachkanal aus: Die Website fragt
 * den Zustand ab, bekommt `voice: false` und zeigt kein Mikrofon. Es gibt
 * keinen halben Zustand, in dem ein Knopf da ist und nichts passiert.
 */

/** Die Stimme, mit der die Praxis spricht. Ruhig, deutlich, ohne Show. */
const VOICE = "alloy";
/**
 * Das Sprachausgabe-Modell. Nur dieses kennt `instructions`; die älteren
 * `tts-1`/`tts-1-hd` ignorieren den Parameter.
 *
 * Achtung für später: Die EU-Residenz gilt **je Modell**, nicht je
 * Endpunkt, und `gpt-4o-mini-tts` steht nicht auf der Residenz-Liste.
 * Sobald die Praxis die EU-Verarbeitung bekommt, muss hier `tts-1` stehen
 * – und dann fällt `instructions` weg. Der Test in `openai.test.mjs` nagelt
 * den Namen fest, damit dieser Wechsel nie unbemerkt in die falsche
 * Richtung passiert.
 */
const TTS_MODEL = "gpt-4o-mini-tts";
/**
 * Das Zuhör-Modell.
 *
 * Nicht `gpt-live-transcribe`, und das ist gemessen, nicht gemeint: Der
 * Anbieter antwortete auf die Sitzungsanfrage mit dem Live-Modell wörtlich
 * „400: Turn detection is not supported for this transcription model."
 * Dieses Modell erkennt kein Satzende – es streamt Wörter und schließt
 * einen Satz erst, wenn der Browser ihm `input_audio_buffer.commit`
 * schickt. Der Zuhör-Automat in `lib/voice/live.ts` ist um das Gegenteil
 * gebaut: Der Anbieter meldet Sprechbeginn und fertigen Satz. Dazu passt
 * `gpt-transcribe`: Satzende-Erkennung auf dem Server, Zwischentext als
 * Deltas, und mit 0,0045 $/min ein Viertel des Preises. Genau das stand
 * schon am 8. 9. als Startempfehlung im Rechercheprotokoll
 * (`docs/sprachkanal-openai.md`) – heute Vormittag habe ich dagegen gebaut.
 */
const STT_MODEL = "gpt-transcribe";
/** Abtastrate, mit der Browser und Anbieter rechnen. */
export const SAMPLE_RATE = 24_000;
/** So lange gilt ein Ausweis. Kurz genug, dass ein Diebstahl nichts nützt. */
const SECRET_TTL_SEC = 600;
/**
 * Der Rahmen, den das Zuhör-Modell bekommt. Kein Personenbezug, nichts aus
 * einem Gespräch – nur das, was auch auf dem Praxisschild steht.
 */
const STT_PROMPT = {
  de: "Terminvereinbarung per Sprache in einer proktologischen Praxis in Hamburg-Eimsbüttel. Typische Sätze: Ich hätte gern einen Termin. Nächste Woche, in zwei Wochen, vormittags, nachmittags, so früh wie möglich, dringend. Ich heiße … Meine E-Mail ist … punkt … at … punkt de. Meine Handynummer ist null eins sieben … Ja, bitte buchen. Nein. Kontrolltermin, Vorsorge, Überweisung.",
  en: "Booking an appointment by voice at a proctology practice in Hamburg-Eimsbüttel. Typical sentences: I would like an appointment. Next week, in two weeks, in the morning, in the afternoon, as soon as possible, urgent. My name is … My email is … dot … at … dot com. My mobile number is zero one seven … Yes, please book. No. Check-up, screening, referral.",
} as const;
// `keywords` und `delay` gehören zum Live-Modell; `gpt-transcribe` lehnt sie
// ab („The 'delay' parameter is not supported for this model" – gemessen).
// Die Fachwörter stehen darum im Prompt, nicht in einer eigenen Liste.
/** Länger als ein Antwortsatz braucht niemand – ein Riegel gegen Missbrauch. */
export const MAX_SPEAK_CHARS = 600;

const BASE_URL = process.env.OPENAI_BASE_URL?.replace(/\/+$/, "") || "https://api.openai.com/v1";

/** Ist der Sprachkanal überhaupt eingerichtet? */
export function voiceConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function key(): string {
  const k = process.env.OPENAI_API_KEY?.trim();
  if (!k) throw new Error("OPENAI_API_KEY fehlt");
  return k;
}

/**
 * Der Grund einer Fehlantwort, kurz und ohne Geheimnisse.
 *
 * Ohne ihn steht im Protokoll nur „502" – und der Betreiber sucht einen
 * Abend lang, obwohl der Anbieter „unknown model" geantwortet hat.
 *
 * Erst lesen und auswerten, **dann** kürzen. Die umgekehrte Reihenfolge sah
 * sparsamer aus und war der teuerste Fehler dieser Datei: Eine echte
 * 401-Antwort von OpenAI ist mit ihrem maskierten Schlüssel und dem
 * Hilfe-Link rund 320 Zeichen lang. Nach einem Schnitt bei 300 ist das
 * JSON kaputt, `JSON.parse` wirft, und herauskommt „keine lesbare
 * Antwort" – ausgerechnet im wichtigsten Fall, dem falschen Schlüssel.
 *
 * Gekürzt wird darum nur noch der herausgelöste Satz. Der Schlüssel steht
 * nie in einer Anbieter-Fehlermeldung; er wird trotzdem maskiert, falls ein
 * Anbieter ihn je zurückspiegelt.
 */
async function reason(res: Response): Promise<string> {
  try {
    const raw = await res.text();
    let satz = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string; code?: string } };
      satz = parsed.error?.message ?? parsed.error?.code ?? raw;
    } catch {
      // Kein JSON – dann eben der rohe Text, gekürzt wie alles andere.
    }
    return maskKeys(satz).slice(0, 300) || "leere Antwort";
  } catch {
    return "keine lesbare Antwort";
  }
}

/** Alles, was wie ein Schlüssel aussieht, verlässt diese Datei unkenntlich. */
function maskKeys(text: string): string {
  return text.replace(/\b(sk|ek)-[A-Za-z0-9_-]{8,}/g, "$1-…");
}

export interface VoiceSecret {
  /** Das kurzlebige Geheimnis für den Browser – niemals der echte Schlüssel. */
  value: string;
  /** Unix-Sekunden, ab wann es wertlos ist. */
  expiresAt: number;
  /** Abtastrate, auf die sich beide Seiten geeinigt haben. */
  sampleRate: number;
}

/**
 * Einen Ausweis für genau eine Zuhör-Sitzung ausstellen.
 *
 * Die Sitzungsanfrage folgt dem belegten Beispiel im Rechercheprotokoll
 * (`docs/sprachkanal-openai.md`, Abschnitt 2):
 *
 *  - `turn_detection: server_vad` mit `silence_duration_ms` deutlich über
 *    dem Auslieferungswert von 700 ms. Wer nach Worten sucht oder mitten im
 *    Satz Luft holt, bekommt gut eine Sekunde Pause zugestanden, statt
 *    abgeschnitten zu werden. (`semantic_vad` wird als eigene Messung
 *    probiert, sobald dieser Pfad läuft – nicht vorher, nicht ungemessen.)
 *  - `language` in der Einzahl: `languages` als Liste, `delay` und
 *    `keywords` gehören zum Live-Modell – `gpt-transcribe` lehnt sie ab.
 *  - `prompt` gibt dem Modell den Rahmen einer Praxis – Fachwörter,
 *    Ortsname, Terminbegriffe. Kein Personenbezug, nichts, was aus einem
 *    Gespräch stammt.
 *  - `noise_reduction: near_field`: Laptop oder Telefon vor dem Gesicht.
 *  - **Kein `format`.** Über WebRTC handelt der Browser das Audio selbst
 *    aus; das Feld gilt für WebSocket-Verbindungen, und dort ist
 *    PCM 16 bit / 24 kHz ohnehin der Auslieferungswert.
 *
 * Jede Zeile hiervon hat den Messkreis durchlaufen: Ausweis-Route aufrufen,
 * Vercel-Runtime-Log lesen. Steht dort ein 400, sagt der Anbieter, welches
 * Feld – und genau dieses wird geändert, nicht drei andere dazu.
 */
export async function mintListenSecret(lang: "de" | "en", signal?: AbortSignal): Promise<VoiceSecret> {
  const res = await fetch(`${BASE_URL}/realtime/client_secrets`, {
    method: "POST",
    headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: SECRET_TTL_SEC },
      session: {
        type: "transcription",
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: {
              model: STT_MODEL,
              language: lang,
              prompt: STT_PROMPT[lang],
            },
            // 1100 ms: Wer einen Satz mit einer Denkpause spricht („… einen
            // Termin … in zwei Wochen“), soll nicht in „Wochen." zerlegt
            // werden – darum nicht weniger. Mehr aber auch nicht: Jede
            // Zehntelsekunde hier ist Stille, die die Patientin als Zögern
            // hört. Wortfetzen, die trotzdem durchkommen, fängt der
            // Stille-Wächter im Automaten ab, ohne zu antworten.
            turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 1100 },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`client_secrets ${res.status}: ${await reason(res)}`);
  const body = (await res.json()) as { value?: string; expires_at?: number };
  if (!body.value) throw new Error("client_secrets ohne value");
  return {
    value: body.value,
    expiresAt: body.expires_at ?? Math.floor(Date.now() / 1000) + SECRET_TTL_SEC,
    sampleRate: SAMPLE_RATE,
  };
}

/**
 * Einen fertigen Satz sprechen lassen. Hereingegeben wird nur, was der
 * Automat selbst formuliert hat – nie der Text der Patientin.
 */
export async function synthesize(text: string, lang: "de" | "en", signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE_URL}/audio/speech`, {
    method: "POST",
    headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: VOICE,
      input: text.slice(0, MAX_SPEAK_CHARS),
      response_format: "mp3",
      // Die Sprache steht schon im Satz; der Hinweis hilft der Aussprache
      // deutscher Straßennamen und Uhrzeiten.
      instructions: lang === "de" ? "Sprich ruhig und deutlich auf Deutsch." : "Speak calmly and clearly in English.",
    }),
  });
  if (!res.ok) throw new Error(`audio/speech ${res.status}: ${await reason(res)}`);
  return res.arrayBuffer();
}
