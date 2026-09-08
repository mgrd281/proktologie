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
/** Abtastrate, mit der Browser und Anbieter rechnen. */
export const SAMPLE_RATE = 24_000;
/** So lange gilt ein Ausweis. Kurz genug, dass ein Diebstahl nichts nützt. */
const SECRET_TTL_SEC = 600;
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
 * `turn_detection: server_vad` heißt: Der Anbieter erkennt selbst, wann
 * ein Satz zu Ende ist. Das ist der Teil, den ein eigener Schwellenwert im
 * Browser nie so gut hinbekommt – und der Grund, warum ältere Anrufer
 * nicht mitten im Satz abgeschnitten werden.
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
            format: { type: "audio/pcm", rate: SAMPLE_RATE },
            transcription: { model: "gpt-live-transcribe", language: lang },
            turn_detection: { type: "server_vad" },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`client_secrets ${res.status}`);
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
      model: "gpt-mini-tts",
      voice: VOICE,
      input: text.slice(0, MAX_SPEAK_CHARS),
      response_format: "mp3",
      // Die Sprache steht schon im Satz; der Hinweis hilft der Aussprache
      // deutscher Straßennamen und Uhrzeiten.
      instructions: lang === "de" ? "Sprich ruhig und deutlich auf Deutsch." : "Speak calmly and clearly in English.",
    }),
  });
  if (!res.ok) throw new Error(`audio/speech ${res.status}`);
  return res.arrayBuffer();
}
