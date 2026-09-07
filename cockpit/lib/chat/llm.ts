/**
 * Sprachmodelle über zwei kostenlose Anbieter, OpenAI-kompatibel per fetch –
 * kein npm-Paket, kein SDK.
 *
 * Reihenfolge: NVIDIA NIM zuerst, OpenRouter als Reserve. Fällt ein Modell
 * aus (kein Schlüssel, Zeitüberschreitung, Fehlerantwort, unbrauchbarer
 * Inhalt), kommt das nächste dran. Antwortet keines, sagt der Assistent das
 * ehrlich – die Schaltflächen-Wege (Termin, Öffnungszeiten, Anfahrt) laufen
 * ohne Modell weiter.
 *
 * ZWEI RIEGEL GEGEN KOSTEN: Bei OpenRouter werden ausschließlich Modell-Ids
 * mit der Endung „:free“ zugelassen – einmal beim Lesen der Kette, einmal
 * unmittelbar vor dem Aufruf. Ein Anbieter ohne Schlüssel wird ohne jeden
 * Netzaufruf übersprungen.
 *
 * Schlüssel kommen ausschließlich aus der Umgebung und stehen nie im Code.
 * Protokolliert werden Anbieter, Modell, Status und Dauer – niemals der
 * Inhalt der Nachricht.
 */
export type Provider = "nvidia" | "openrouter";

export interface ModelRef {
  provider: Provider;
  model: string;
}

export interface LlmEnv {
  NVIDIA_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  CHAT_MODEL_CHAIN?: string;
  CHAT_NVIDIA_BASE_URL?: string;
  CHAT_OPENROUTER_BASE_URL?: string;
  CHAT_LLM_TIMEOUT_MS?: string;
  CHAT_LLM_BUDGET_MS?: string;
}

export const DEFAULT_CHAIN =
  "nvidia:minimaxai/minimax-m3,nvidia:nvidia/nemotron-3-ultra-550b-a55b,openrouter:minimax/minimax-m3:free,openrouter:nvidia/nemotron-3-super-120b-a12b:free";

export const BASE_URLS: Record<Provider, string> = {
  nvidia: "https://integrate.api.nvidia.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const KEY_ENV: Record<Provider, keyof LlmEnv> = {
  nvidia: "NVIDIA_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_BUDGET_MS = 20000;

/**
 * Riegel 1: Beim Lesen der Kette. Fehlformen und jede kostenpflichtige
 * OpenRouter-Id fliegen hier heraus und tauchen gar nicht erst auf.
 */
export function isAllowed(ref: ModelRef): boolean {
  if (ref.provider === "openrouter") return ref.model.endsWith(":free");
  return true;
}

export function parseChain(raw: string = DEFAULT_CHAIN): ModelRef[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(":");
      if (idx <= 0) return null;
      const provider = part.slice(0, idx).trim().toLowerCase();
      const model = part.slice(idx + 1).trim();
      if (!model) return null;
      if (provider !== "nvidia" && provider !== "openrouter") return null;
      return { provider, model } as ModelRef;
    })
    .filter((r): r is ModelRef => r !== null && isAllowed(r));
}

export interface LlmCall {
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  /** Strikte JSON-Antwort verlangen (Klassifikation) */
  json?: boolean;
}

export type LlmResult =
  | { ok: true; text: string; model: ModelRef; ms: number }
  | { ok: false; reason: "no_provider" | "all_failed" | "budget"; tried: string[] };

function baseUrl(provider: Provider, env: LlmEnv): string {
  const override = provider === "nvidia" ? env.CHAT_NVIDIA_BASE_URL : env.CHAT_OPENROUTER_BASE_URL;
  return (override || BASE_URLS[provider]).replace(/\/+$/, "");
}

function contentOf(body: unknown): string | null {
  const choices = (body as { choices?: Array<{ message?: { content?: unknown } }> })?.choices;
  const text = Array.isArray(choices) ? choices[0]?.message?.content : undefined;
  return typeof text === "string" && text.trim() ? text : null;
}

export async function complete(
  call: LlmCall,
  io: { env?: LlmEnv; fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<LlmResult> {
  const env = (io.env ?? (process.env as unknown as LlmEnv)) satisfies LlmEnv;
  const fetchImpl = io.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const now = io.now ?? (() => Date.now());
  const timeoutMs = Number(env.CHAT_LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const budgetMs = Number(env.CHAT_LLM_BUDGET_MS ?? DEFAULT_BUDGET_MS) || DEFAULT_BUDGET_MS;

  const chain = parseChain(env.CHAT_MODEL_CHAIN || DEFAULT_CHAIN);
  const started = now();
  const tried: string[] = [];
  let sawProvider = false;

  for (const ref of chain) {
    const key = env[KEY_ENV[ref.provider]];
    // Ohne Schlüssel gar nicht erst ins Netz gehen
    if (!key) continue;
    // Riegel 2: unmittelbar vor dem Aufruf noch einmal prüfen
    if (!isAllowed(ref)) continue;
    sawProvider = true;
    if (now() - started >= budgetMs) return { ok: false, reason: "budget", tried };

    const label = `${ref.provider}:${ref.model}`;
    tried.push(label);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const t0 = now();
    try {
      const res = await fetchImpl(`${baseUrl(ref.provider, env)}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: ref.model,
          messages: call.messages,
          temperature: call.temperature ?? 0.2,
          max_tokens: call.maxTokens ?? 400,
          ...(call.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      const ms = now() - t0;
      if (!res.ok) {
        console.info(`chat.llm provider=${ref.provider} model=${ref.model} status=${res.status} ms=${ms}`);
        continue;
      }
      const text = contentOf(await res.json());
      if (!text) {
        console.info(`chat.llm provider=${ref.provider} model=${ref.model} status=leer ms=${ms}`);
        continue;
      }
      console.info(`chat.llm provider=${ref.provider} model=${ref.model} status=200 ms=${ms}`);
      return { ok: true, text, model: ref, ms };
    } catch {
      // Zeitüberschreitung, Netzfehler, unbrauchbares JSON – nie den Inhalt loggen
      console.info(`chat.llm provider=${ref.provider} model=${ref.model} status=fehler ms=${now() - t0}`);
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, reason: sawProvider ? "all_failed" : "no_provider", tried };
}
