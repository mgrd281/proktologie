import { z } from "zod";
import { PRACTICE } from "../practice.ts";
import { fmtLongDateLocale } from "../time.ts";
import { answerFromFacts, findTopics, groundingCheck, type LiveFacts, type Topic } from "./knowledge.ts";
import { detectLanguage, type Lang } from "./language.ts";
import type { LlmCall } from "./llm.ts";
import { classifyPrompt, groundPrompt, parseClassification, type ModelView } from "./prompts.ts";
import { detectEmergency, detectHealthData, maskPii } from "./safety.ts";
import { matchType, parseDateWords, parseTimeWords, renderSlotAnswer, type SlotAnswer, type ToolContext } from "./tools.ts";
import { t } from "./texts.ts";

/**
 * Der Gesprächsablauf – ein Automat, kein Sprachmodell.
 *
 * Was hier entschieden wird, entscheiden Regeln: welcher Schritt kommt,
 * welche Zeiten es gibt, ob gebucht wird. Das Modell wird an genau zwei
 * Stellen gefragt, und beide Male ist seine Antwort nur ein Vorschlag:
 *
 *   1. Einordnen eines freien Satzes (striktes JSON, gegen Zod geprüft;
 *      genannte Daten und Uhrzeiten werden anschließend gegen die eigenen
 *      Parser gegengeprüft – erfundene Termine kommen so nicht durch).
 *   2. Umformulieren einer Antwort aus gepflegten Fakten (mit Nachprüfung
 *      in `groundingCheck`; fällt sie durch, gilt der Faktentext).
 *
 * Fällt jeder Anbieter aus, funktioniert der ganze Weg über Schaltflächen
 * unverändert weiter. Das ist Absicht: Der Chat darf nicht davon abhängen,
 * dass ein kostenloser Dienst gerade antwortet.
 *
 * Personenbezug: Name, E-Mail und Telefon werden ausschließlich über
 * Formularfelder erfasst. Sie stehen im Zustand (der im Browser liegt) und
 * gehen direkt an die Buchung. Auf dem Weg zum Modell existieren sie nicht –
 * `ModelView` hat kein Feld dafür, und Freitext wird vorher maskiert.
 *
 * Der Zustand kommt vom Browser und ist damit fremd. Er wird bei jedem
 * Aufruf geprüft; was nicht passt, wird durch einen frischen Zustand
 * ersetzt. Ein manipulierter Entwurf bringt niemandem etwas: Vor jeder
 * Buchung prüft die Datenbank Terminart, Zeit und Belegung erneut.
 */

// ---------------------------------------------------------------- Typen

export type Stage = "idle" | "type" | "date" | "time" | "contact" | "confirm" | "callback" | "done";
export type Intent = "booking" | "hours" | "directions" | "info" | "handover" | "forward";
export type CallbackKind = "rueckruf" | "folgerezept" | "ueberweisung" | "befundkopie" | "sonstiges";

export interface Contact {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface TypeInfo {
  id: string;
  label: string;
  durationMin: number;
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;

export const chatStateSchema = z.object({
  v: z.literal(1),
  lang: z.enum(["de", "en"]),
  stage: z.enum(["idle", "type", "date", "time", "contact", "confirm", "callback", "done"]),
  intent: z.enum(["booking", "hours", "directions", "info", "handover", "forward"]).nullable(),
  draft: z.object({
    typeId: z.string().max(60).nullable(),
    date: z.string().regex(dateRe).nullable(),
    time: z.string().regex(timeRe).nullable(),
    contact: z
      .object({
        firstName: z.string().max(80),
        lastName: z.string().max(80),
        email: z.string().max(200),
        phone: z.string().max(40).optional(),
      })
      .nullable(),
  }),
  lastOffer: z.array(z.object({ date: z.string().regex(dateRe), time: z.string().regex(timeRe) })).max(8),
  callbackKind: z.enum(["rueckruf", "folgerezept", "ueberweisung", "befundkopie", "sonstiges"]).nullable(),
  failures: z.number().int().min(0).max(9),
  turns: z.number().int().min(0).max(500),
});
export type ChatState = z.infer<typeof chatStateSchema>;

export const chatRequestSchema = z.object({
  v: z.literal(1),
  sessionId: z.string().uuid(),
  state: z.unknown().nullish(),
  message: z.string().max(600).optional(),
  action: z
    .union([
      z.object({ kind: z.literal("quick"), id: z.string().max(60) }),
      z.object({
        kind: z.literal("form"),
        formId: z.enum(["contact", "callback"]),
        values: z.record(z.string().max(40), z.string().max(600)),
      }),
    ])
    .optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface QuickReply {
  id: string;
  label: string;
}

export interface ChatFormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "select" | "checkbox" | "textarea";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface ChatForm {
  id: "contact" | "callback";
  title: string;
  submit: string;
  fields: ChatFormField[];
}

export interface ChatResponse {
  reply: string;
  lang: Lang;
  state: ChatState;
  quick?: QuickReply[];
  form?: ChatForm;
  links?: Array<{ label: string; href: string }>;
  flags: {
    emergency?: true;
    handover?: true;
    booked?: { ref: string; mail: "sent" | "failed" };
    /** „model“ = eine Modellantwort wurde verwendet, „fallback“ = verworfen oder nicht erreichbar. */
    llm: "model" | "fallback" | "none";
  };
}

export interface BookInput {
  typeId: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  locale: Lang;
}

export type BookOutcome =
  | { ok: true; ref: string; typeLabel: string; mail: "sent" | "failed" }
  | { ok: false; code: "slot_taken" | "too_many" | "rate_limited" | "not_live" | "paused" | "error"; banner?: string | null };

export interface CallbackFormInput {
  kind: CallbackKind;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  preferredTime: "egal" | "vormittags" | "nachmittags";
  note?: string;
  locale: Lang;
}

export type CallbackOutcome = { ok: true; ref: string } | { ok: false; code: "rate_limited" | "validation" | "blocked" };

/**
 * Alles, was der Automat von außen braucht. Als Abhängigkeiten übergeben,
 * damit der Ablauf ohne Datenbank, ohne Netz und ohne Mailversand geprüft
 * werden kann – und damit im Test nachweisbar ist, was das Modell zu sehen
 * bekommt.
 */
export interface ChatDeps {
  now(): Date;
  types(): Promise<TypeInfo[]>;
  availability(args: { art: string; datum?: string | null; uhrzeit?: string | null }, ctx: ToolContext): Promise<SlotAnswer>;
  nextFree(args: { art: string }, ctx: ToolContext): Promise<SlotAnswer>;
  info(lang: Lang): Promise<LiveFacts>;
  classify(call: LlmCall): Promise<string | null>;
  phrase(call: LlmCall): Promise<string | null>;
  book(input: BookInput): Promise<BookOutcome>;
  callback(input: CallbackFormInput): Promise<CallbackOutcome>;
  /** false = für diese Adresse ist das Tageslimit erreicht. */
  bookingsToday(email: string): Promise<boolean>;
  isBlocked(email: string | null, phone: string | null): boolean;
  audit(event: string, data?: Record<string, unknown>): void;
}

// ------------------------------------------------------------- Zustand

export function freshState(lang: Lang = "de"): ChatState {
  return {
    v: 1,
    lang,
    stage: "idle",
    intent: null,
    draft: { typeId: null, date: null, time: null, contact: null },
    lastOffer: [],
    callbackKind: null,
    failures: 0,
    turns: 0,
  };
}

function reviveState(raw: unknown, fallbackLang: Lang): ChatState {
  const parsed = chatStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : freshState(fallbackLang);
}

// -------------------------------------------------------- Bausteine UI

function quick(lang: Lang, ids: Array<"book" | "hours" | "directions" | "yes" | "no" | "callback" | "nextfree" | "other">): QuickReply[] {
  const q = t(lang).quick;
  return ids.map((id) => ({ id, label: q[id] }));
}

function typeQuick(types: TypeInfo[]): QuickReply[] {
  return types.map((x) => ({ id: `type:${x.id}`, label: x.label }));
}

function timeQuick(lang: Lang, date: string, times: string[]): QuickReply[] {
  const uhr = lang === "de" ? " Uhr" : "";
  return times.map((time) => ({ id: `time:${date}|${time}`, label: `${time}${uhr}` }));
}

function dayQuick(lang: Lang, days: Array<{ date: string; slots: string[] }>): QuickReply[] {
  return days.map((d) => ({ id: `date:${d.date}`, label: fmtLongDateLocale(new Date(`${d.date}T12:00:00Z`), lang) }));
}

function contactForm(lang: Lang): ChatForm {
  const f = t(lang).form;
  return {
    id: "contact",
    title: f.contactTitle,
    submit: f.submitContact,
    fields: [
      { name: "firstName", label: f.firstName, type: "text", required: true },
      { name: "lastName", label: f.lastName, type: "text", required: true },
      { name: "email", label: f.email, type: "email", required: true },
      { name: "phone", label: f.phoneOptional, type: "tel", required: false },
      { name: "consent", label: f.consent, type: "checkbox", required: true },
    ],
  };
}

function callbackForm(lang: Lang, kind: CallbackKind): ChatForm {
  const f = t(lang).form;
  const kinds: CallbackKind[] = ["rueckruf", "folgerezept", "ueberweisung", "befundkopie", "sonstiges"];
  return {
    id: "callback",
    title: f.callbackTitle,
    submit: f.submitCallback,
    fields: [
      {
        name: "kind",
        label: f.kind,
        type: "select",
        required: true,
        options: [kind, ...kinds.filter((k) => k !== kind)].map((k) => ({ value: k, label: f.kinds[k] })),
      },
      { name: "firstName", label: f.firstName, type: "text", required: true },
      { name: "lastName", label: f.lastName, type: "text", required: true },
      { name: "phone", label: f.phone, type: "tel", required: true },
      { name: "email", label: f.emailOptional, type: "email", required: false },
      {
        name: "preferredTime",
        label: f.preferredTime,
        type: "select",
        required: true,
        options: (["egal", "vormittags", "nachmittags"] as const).map((k) => ({ value: k, label: f.preferred[k] })),
      },
      { name: "note", label: f.note, type: "textarea", required: false },
    ],
  };
}

interface Extras {
  quick?: QuickReply[];
  form?: ChatForm;
  links?: Array<{ label: string; href: string }>;
  flags?: Partial<ChatResponse["flags"]>;
}

function say(state: ChatState, reply: string, extras: Extras = {}): ChatResponse {
  const { flags, ...rest } = extras;
  return { reply, lang: state.lang, state, flags: { llm: "none", ...flags }, ...rest };
}

const phone = PRACTICE.phone;

function telLinks(lang: Lang): Array<{ label: string; href: string }> {
  return [
    { label: lang === "de" ? "Notruf 112" : "Emergency 112", href: "tel:112" },
    { label: lang === "de" ? "Bereitschaftsdienst 116 117" : "Out-of-hours service 116 117", href: "tel:116117" },
  ];
}

function practiceLink(lang: Lang): Array<{ label: string; href: string }> {
  return [{ label: lang === "de" ? `Anrufen: ${phone}` : `Call us: ${phone}`, href: `tel:${phone.replace(/\s/g, "")}` }];
}

// ------------------------------------------------------------- Regeln

const HANDOVER_RE =
  /(mit (?:einem |einer )?(?:menschen?|mitarbeiter|mensch)|echte[rn]? mensch|jemanden sprechen|jemand sprechen|persönlich sprechen|mit dem team|mitarbeiterin|rezeption|speak (?:to|with) (?:a )?(?:human|someone|somebody|person|staff)|talk to (?:a )?(?:human|someone|somebody|person)|real person)/iu;
const FORWARD_RE =
  /(rezept|folgerezept|krankschreibung|krankmeldung|arbeitsunfähig|attest|befund|überweisung|ueberweisung|prescription|sick note|sick leave|medical certificate|referral|findings|test results)/iu;
/** „Brauche ich eine Überweisung?“ ist eine Frage, keine Bitte um Weiterleitung. */
const ASKS_WHETHER_RE = /(brauche ich|braucht man|benötige ich|benoetige ich|muss ich|ist eine|ist ein |nötig|noetig|erforderlich|do i need|is a |is an |necessary|required)/iu;
const BOOKING_RE = /(termin|buchen|vereinbaren|sprechstunde bekommen|appointment|book|booking|schedule)/iu;
const FREE_SLOT_RE = /(frei|verfügbar|verfuegbar|zeit|available|free|slot|open)/iu;
const YES_RE = /^(ja|jawohl|ja bitte|ja gerne|ja, bitte|genau|gern|gerne|ok|okay|passt|richtig|stimmt|yes|yes please|sure|correct|right|please do)\b/iu;
const NO_RE = /^(nein|nee|ne\b|nicht|lieber nicht|ändern|aendern|anders|no|nope|change|not quite)\b/iu;

const FORWARD_KIND: Array<{ kind: CallbackKind; re: RegExp }> = [
  { kind: "folgerezept", re: /(rezept|prescription)/iu },
  { kind: "ueberweisung", re: /(überweisung|ueberweisung|referral)/iu },
  { kind: "befundkopie", re: /(befund|findings|test results)/iu },
  { kind: "sonstiges", re: /(krankschreibung|krankmeldung|arbeitsunfähig|attest|sick note|sick leave|medical certificate)/iu },
];

function forwardKind(text: string): CallbackKind {
  return FORWARD_KIND.find((x) => x.re.test(text))?.kind ?? "rueckruf";
}

// -------------------------------------------------------------- Ablauf

/** Alles, was die Patientin in diesem Zug geschrieben hat – auch in Formularfeldern. */
export function collectText(req: ChatRequest): string {
  return [req.message ?? "", ...Object.values(req.action?.kind === "form" ? req.action.values : {})].join("\n");
}

/** Notfall? Diese Prüfung braucht weder Datenbank noch Modell noch Zustand. */
export function isEmergency(req: ChatRequest): boolean {
  return detectEmergency(collectText(req)) !== null;
}

/** Der geprüfte Zustand aus der Anfrage – manipuliertes wird verworfen. */
export function stateFor(req: ChatRequest): ChatState {
  return reviveState(req.state, detectLanguage(req.message ?? "", "de").lang);
}

/**
 * Die Notfallantwort. Sie steht bewusst als eigene Funktion da: Die Route
 * gibt sie aus, bevor gezählt, geprüft oder abgeschaltet wird – 112 muss
 * auch dann erscheinen, wenn der Chat pausiert oder das Limit erreicht ist.
 */
export function emergencyReply(state: ChatState): ChatResponse {
  return say({ ...state, stage: "idle", failures: 0 }, t(state.lang).emergency, {
    links: telLinks(state.lang),
    flags: { emergency: true },
  });
}

export async function runTurn(req: ChatRequest, deps: ChatDeps): Promise<ChatResponse> {
  const now = deps.now();
  let state = stateFor(req);
  state = { ...state, turns: Math.min(state.turns + 1, 500) };

  // 1. Notfall geht allem voraus – auch dem, was in einem Formularfeld steht.
  if (isEmergency(req)) {
    deps.audit("chat.emergency");
    return emergencyReply(state);
  }

  if (req.action?.kind === "form") return handleForm(req.action, state, deps);
  if (req.action?.kind === "quick") return handleQuick(req.action.id, state, deps, now);

  const text = (req.message ?? "").trim();
  if (!text) return say(state, t(state.lang).notUnderstood, { quick: quick(state.lang, ["book", "hours", "directions"]) });
  return handleMessage(text, state, deps, now);
}

// -------------------------------------------------------- Freier Text

async function handleMessage(text: string, prev: ChatState, deps: ChatDeps, now: Date): Promise<ChatResponse> {
  const guess = detectLanguage(text, prev.lang);
  const lang: Lang = guess.confidence === "high" ? guess.lang : prev.lang;
  const state: ChatState = { ...prev, lang };
  const T = t(lang);

  // 2. Gesundheitsangaben: Hinweis statt Verarbeitung – das Modell sieht
  //    diesen Text nicht, und gespeichert wird er auch nicht.
  const health = detectHealthData(text);
  if (health) {
    deps.audit("chat.health_filtered", { medicalQuestion: health.medicalQuestion });
    const types = await deps.types();
    const named = matchType(text, types, lang);
    if (health.medicalQuestion) {
      return say({ ...state, failures: 0 }, T.medicalRefusal, { quick: quick(lang, ["book", "callback"]) });
    }
    // „Hämorrhoiden“ ist zugleich eine Terminart: Hinweis geben und die
    // Auswahl anbieten, statt die Schilderung zu verarbeiten.
    if (named || state.stage === "type") {
      return say({ ...state, stage: "type", intent: "booking", failures: 0 }, `${T.healthHint} ${T.askType}`, { quick: typeQuick(types) });
    }
    return say({ ...state, failures: 0 }, T.healthHint, { quick: quick(lang, ["book", "hours", "directions"]) });
  }

  // 3. Ab hier darf ein Modell mitreden – aber nur maskiert.
  const masked = maskPii(text);
  if (masked.masked.length) deps.audit("chat.masked", { kinds: masked.masked });

  // 4. Wünsche, die in jedem Schritt gelten
  if (HANDOVER_RE.test(text)) {
    const hours = (await deps.info(lang)).hoursText;
    return say({ ...state, intent: "handover", failures: 0 }, `${T.handover} ${hoursSentence(lang, hours)}`, {
      quick: quick(lang, ["callback"]),
      links: practiceLink(lang),
      flags: { handover: true },
    });
  }
  if (FORWARD_RE.test(text) && !ASKS_WHETHER_RE.test(text)) {
    const kind = forwardKind(text);
    return say({ ...state, stage: "callback", intent: "forward", callbackKind: kind, failures: 0 }, T.forward, {
      form: callbackForm(lang, kind),
      links: practiceLink(lang),
      flags: { handover: true },
    });
  }

  // 5. Antwort auf die gerade gestellte Frage
  switch (state.stage) {
    case "confirm": {
      if (YES_RE.test(text)) return book(state, deps, now);
      if (NO_RE.test(text)) return say({ ...state, stage: "date", draft: { ...state.draft, date: null, time: null }, failures: 0 }, T.changed, { quick: quick(lang, ["nextfree"]) });
      if (state.failures === 0) return say({ ...state, failures: 1 }, T.confirmAgain, { quick: quick(lang, ["yes", "no"]) });
      return say({ ...state, stage: "date", draft: { ...state.draft, date: null, time: null }, failures: 0 }, T.changed, { quick: quick(lang, ["nextfree"]) });
    }
    case "type": {
      const types = await deps.types();
      const id = matchType(text, types, lang);
      if (id && types.some((x) => x.id === id)) return afterType(id, { ...state, failures: 0 }, deps, now, text);
      break;
    }
    case "date":
    case "time": {
      const date = parseDateWords(text, now, lang);
      const time = parseTimeWords(text);
      if (date || time) return checkSlot({ ...state, failures: 0 }, deps, now, date ?? state.draft.date, time ?? (date ? null : state.draft.time));
      break;
    }
    default:
      break;
  }

  // 6. Terminwunsch im freien Satz
  const date = parseDateWords(text, now, lang);
  const time = parseTimeWords(text);
  if (BOOKING_RE.test(text) || ((date || time) && FREE_SLOT_RE.test(text))) {
    return startBooking({ ...state, failures: 0 }, deps, now, text, date, time);
  }

  // 7. Frage zur Praxis – aus gepflegten Fakten, notfalls vom Modell formuliert
  const topics = findTopics(text, lang);
  if (topics.length) return answerTopics(topics, { ...state, failures: 0 }, deps, masked.text);

  // 8. Erst jetzt das Modell fragen – und nur als Hinweis
  return classifyAndRoute(text, masked.text, state, deps, now);
}

function hoursSentence(lang: Lang, hoursText: string): string {
  return lang === "de" ? `Sprechzeiten: ${hoursText}.` : `Opening hours: ${hoursText}.`;
}

// ------------------------------------------------------ Schaltflächen

async function handleQuick(id: string, prev: ChatState, deps: ChatDeps, now: Date): Promise<ChatResponse> {
  const state: ChatState = { ...prev, failures: 0 };
  const lang = state.lang;
  const T = t(lang);

  if (id === "book") return startBooking(state, deps, now, "", null, null);
  if (id === "hours" || id === "directions") {
    const topics: Topic[] = id === "hours" ? ["oeffnungszeiten"] : ["anfahrt", "adresse"];
    return answerTopics(topics, state, deps, null);
  }
  if (id === "callback") {
    const kind = state.callbackKind ?? "rueckruf";
    return say({ ...state, stage: "callback", callbackKind: kind }, T.callbackIntro, { form: callbackForm(lang, kind) });
  }
  if (id === "nextfree") {
    if (!state.draft.typeId) return startBooking(state, deps, now, "", null, null);
    const answer = await deps.nextFree({ art: state.draft.typeId }, { now, lang });
    return renderAvailability(answer, { ...state, stage: "date" }, deps, now);
  }
  if (id === "yes") return state.stage === "confirm" ? book(state, deps, now) : say(state, T.notUnderstood, { quick: quick(lang, ["book", "hours", "directions"]) });
  if (id === "no" || id === "other") {
    return say({ ...state, stage: "date", draft: { ...state.draft, date: null, time: null } }, T.changed, { quick: quick(lang, ["nextfree"]) });
  }
  if (id.startsWith("type:")) {
    const typeId = id.slice(5);
    const types = await deps.types();
    if (!types.some((x) => x.id === typeId)) return say(state, T.askType, { quick: typeQuick(types) });
    return afterType(typeId, state, deps, now, "");
  }
  if (id.startsWith("date:")) {
    const date = id.slice(5);
    if (!dateRe.test(date)) return say(state, T.askDate);
    return checkSlot(state, deps, now, date, null);
  }
  if (id.startsWith("time:")) {
    const [date, time] = id.slice(5).split("|");
    if (!date || !time || !dateRe.test(date) || !timeRe.test(time)) return say(state, T.askTime);
    return checkSlot(state, deps, now, date, time);
  }
  return say(state, T.notUnderstood, { quick: quick(lang, ["book", "hours", "directions"]) });
}

// ---------------------------------------------------------- Formulare

async function handleForm(
  action: { kind: "form"; formId: "contact" | "callback"; values: Record<string, string> },
  prev: ChatState,
  deps: ChatDeps,
): Promise<ChatResponse> {
  const state: ChatState = { ...prev, failures: 0 };
  const lang = state.lang;
  const T = t(lang);
  const v = action.values;
  const get = (k: string) => (v[k] ?? "").trim();
  const checked = (k: string) => ["true", "on", "1", "ja", "yes"].includes(get(k).toLowerCase());

  if (action.formId === "contact") {
    const errors: string[] = [];
    if (!get("firstName")) errors.push(T.errors.firstName);
    if (!get("lastName")) errors.push(T.errors.lastName);
    if (!isEmail(get("email"))) errors.push(T.errors.email);
    if (!checked("consent")) errors.push(T.errors.consent);
    if (errors.length) return say({ ...state, stage: "contact" }, errors.join(" "), { form: contactForm(lang) });

    const contact: Contact = {
      firstName: get("firstName").slice(0, 80),
      lastName: get("lastName").slice(0, 80),
      email: get("email").slice(0, 200),
      phone: get("phone") ? get("phone").slice(0, 40) : undefined,
    };
    const next: ChatState = { ...state, stage: "confirm", draft: { ...state.draft, contact } };
    return say(next, await summarySentence(next, deps), { quick: quick(lang, ["yes", "no"]) });
  }

  // Rückruf
  const errors: string[] = [];
  if (!get("firstName")) errors.push(T.errors.firstName);
  if (!get("lastName")) errors.push(T.errors.lastName);
  if (get("phone").length < 5) errors.push(T.errors.phone);
  if (get("email") && !isEmail(get("email"))) errors.push(T.errors.email);
  const kind = (["rueckruf", "folgerezept", "ueberweisung", "befundkopie", "sonstiges"] as CallbackKind[]).includes(get("kind") as CallbackKind)
    ? (get("kind") as CallbackKind)
    : (state.callbackKind ?? "rueckruf");
  if (errors.length) return say({ ...state, stage: "callback" }, errors.join(" "), { form: callbackForm(lang, kind) });

  // Freiwillig genannte Gesundheitsangaben werden nicht gespeichert.
  const rawNote = get("note");
  const noteHasHealth = rawNote ? detectHealthData(rawNote) !== null : false;
  const note = noteHasHealth ? "" : rawNote.slice(0, 500);
  if (noteHasHealth) deps.audit("chat.note_dropped");

  if (deps.isBlocked(get("email") || null, get("phone"))) {
    deps.audit("chat.blocked", { where: "callback" });
    return say({ ...state, stage: "done" }, T.blocked, { links: practiceLink(lang) });
  }

  const preferred = (["egal", "vormittags", "nachmittags"] as const).includes(get("preferredTime") as "egal") ? (get("preferredTime") as "egal") : "egal";
  const outcome = await deps.callback({
    kind,
    firstName: get("firstName"),
    lastName: get("lastName"),
    phone: get("phone"),
    email: get("email") || undefined,
    preferredTime: preferred,
    note: note || undefined,
    locale: lang,
  });
  if (!outcome.ok) {
    const message = outcome.code === "rate_limited" ? T.rateLimited : outcome.code === "blocked" ? T.blocked : T.callbackFailed;
    return say({ ...state, stage: "callback" }, message, { links: practiceLink(lang) });
  }
  const dropped = noteHasHealth ? ` ${T.healthHint}` : "";
  const ref = lang === "de" ? `Ihre Referenz: ${outcome.ref}.` : `Your reference: ${outcome.ref}.`;
  return say({ ...state, stage: "done", callbackKind: null }, `${T.callbackSaved} ${ref}${dropped}`, { quick: quick(lang, ["book", "hours"]) });
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

// ------------------------------------------------------------ Buchung

async function startBooking(
  state: ChatState,
  deps: ChatDeps,
  now: Date,
  text: string,
  date: string | null,
  time: string | null,
): Promise<ChatResponse> {
  const lang = state.lang;
  const types = await deps.types();
  if (types.length === 0) return say({ ...state, stage: "idle" }, t(lang).bookNotPossible, { links: practiceLink(lang) });

  const named = text ? matchType(text, types, lang) : null;
  const typeId = named && types.some((x) => x.id === named) ? named : state.draft.typeId;
  const next: ChatState = { ...state, intent: "booking", draft: { ...state.draft, typeId, date: date ?? state.draft.date, time: time ?? state.draft.time } };

  if (!typeId) {
    // Ohne genannte Terminart nicht raten: Wenn schon ein Tag im Raum
    // steht, wird er mit der allgemeinen Terminart beantwortet – die
    // Auswahl kommt trotzdem, denn danach wird erneut geprüft.
    if (next.draft.date || next.draft.time) {
      const fallback = types.find((x) => x.id === "unklar") ?? types[0]!;
      const answer = await deps.availability({ art: fallback.id, datum: next.draft.date, uhrzeit: next.draft.time }, { now, lang });
      const sentence = renderSlotAnswer(answer, lang, fallback.label, phone, now);
      return say({ ...next, stage: "type" }, `${sentence} ${t(lang).askType}`, { quick: typeQuick(types) });
    }
    return say({ ...next, stage: "type" }, t(lang).askType, { quick: typeQuick(types) });
  }
  return afterType(typeId, next, deps, now, text);
}

async function afterType(typeId: string, state: ChatState, deps: ChatDeps, now: Date, text: string): Promise<ChatResponse> {
  const lang = state.lang;
  const date = state.draft.date ?? (text ? parseDateWords(text, now, lang) : null);
  const time = state.draft.time ?? (text ? parseTimeWords(text) : null);
  const next: ChatState = { ...state, intent: "booking", draft: { ...state.draft, typeId, date, time } };
  if (date) return checkSlot(next, deps, now, date, time);
  return say({ ...next, stage: "date" }, t(lang).askDate, { quick: quick(lang, ["nextfree"]) });
}

/** Verfügbarkeit fragen und daraus den nächsten Schritt ableiten. */
async function checkSlot(state: ChatState, deps: ChatDeps, now: Date, date: string | null, time: string | null): Promise<ChatResponse> {
  const lang = state.lang;
  if (!state.draft.typeId) return startBooking(state, deps, now, "", date, time);
  const answer = await deps.availability({ art: state.draft.typeId, datum: date, uhrzeit: time }, { now, lang });
  const next: ChatState = { ...state, draft: { ...state.draft, date, time: answer.kind === "time_free" ? time : null } };
  return renderAvailability(answer, next, deps, now);
}

async function renderAvailability(answer: SlotAnswer, state: ChatState, deps: ChatDeps, now: Date): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const types = await deps.types();
  const label = types.find((x) => x.id === state.draft.typeId)?.label ?? "";
  const sentence = renderSlotAnswer(answer, lang, label, phone, now);

  switch (answer.kind) {
    case "time_free": {
      const next: ChatState = { ...state, stage: "contact", draft: { ...state.draft, date: answer.date, time: answer.time } };
      return say(next, `${sentence} ${T.askContact}`, { form: contactForm(lang) });
    }
    case "time_taken": {
      const next: ChatState = {
        ...state,
        stage: "time",
        draft: { ...state.draft, date: answer.date, time: null },
        lastOffer: answer.alternatives.map((time) => ({ date: answer.date, time })),
      };
      return say(next, sentence, { quick: timeQuick(lang, answer.date, answer.alternatives) });
    }
    case "day_slots": {
      const next: ChatState = {
        ...state,
        stage: "time",
        draft: { ...state.draft, date: answer.date, time: null },
        lastOffer: answer.slots.map((time) => ({ date: answer.date, time })),
      };
      return say(next, `${sentence} ${T.askTime}`, { quick: timeQuick(lang, answer.date, answer.slots) });
    }
    case "day_empty": {
      const next: ChatState = { ...state, stage: "date", draft: { ...state.draft, date: null, time: null } };
      return say(next, sentence, { quick: dayQuick(lang, answer.nextDays) });
    }
    case "next_days": {
      const next: ChatState = { ...state, stage: "date", draft: { ...state.draft, date: null, time: null } };
      return say(next, sentence, { quick: dayQuick(lang, answer.days) });
    }
    case "unavailable": {
      const next: ChatState = { ...state, stage: answer.reason === "past" ? "date" : "idle" };
      return say(next, sentence, { links: answer.reason === "past" ? undefined : practiceLink(lang) });
    }
  }
}

async function summarySentence(state: ChatState, deps: ChatDeps): Promise<string> {
  const lang = state.lang;
  const d = state.draft;
  const types = await deps.types();
  const label = types.find((x) => x.id === d.typeId)?.label ?? "";
  const day = d.date ? fmtLongDateLocale(new Date(`${d.date}T12:00:00Z`), lang) : "";
  const c = d.contact;
  const who = c ? `${c.firstName} ${c.lastName} (${c.email})` : "";
  const head =
    lang === "de" ? `${label} am ${day} um ${d.time} Uhr für ${who}.` : `${label} on ${day} at ${d.time} for ${who}.`;
  return `${head} ${t(lang).confirmQuestion}`;
}

async function book(state: ChatState, deps: ChatDeps, now: Date): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const d = state.draft;
  if (!d.typeId || !d.date || !d.time) return say({ ...state, stage: "date" }, T.askDate, { quick: quick(lang, ["nextfree"]) });
  if (!d.contact) return say({ ...state, stage: "contact" }, T.askContact, { form: contactForm(lang) });

  if (deps.isBlocked(d.contact.email, d.contact.phone ?? null)) {
    deps.audit("chat.blocked", { where: "booking" });
    return say({ ...state, stage: "done" }, T.blocked, { links: practiceLink(lang) });
  }
  if (!(await deps.bookingsToday(d.contact.email))) {
    deps.audit("chat.daily_limit");
    return say({ ...state, stage: "done" }, T.dailyLimit, { links: practiceLink(lang) });
  }

  const outcome = await deps.book({
    typeId: d.typeId,
    date: d.date,
    time: d.time,
    firstName: d.contact.firstName,
    lastName: d.contact.lastName,
    email: d.contact.email,
    phone: d.contact.phone,
    locale: lang,
  });

  if (outcome.ok) {
    const day = fmtLongDateLocale(new Date(`${d.date}T12:00:00Z`), lang);
    const head =
      lang === "de"
        ? `Gebucht: ${outcome.typeLabel} am ${day} um ${d.time} Uhr. Ihre Referenz: ${outcome.ref}.`
        : `Booked: ${outcome.typeLabel} on ${day} at ${d.time}. Your reference: ${outcome.ref}.`;
    const tail = outcome.mail === "sent" ? T.bookedMailSent : T.bookedMailFailed;
    return say({ ...state, stage: "done", intent: null, lastOffer: [] }, `${head} ${tail}`, {
      flags: { booked: { ref: outcome.ref, mail: outcome.mail } },
    });
  }

  switch (outcome.code) {
    case "slot_taken": {
      const answer = await deps.availability({ art: d.typeId, datum: d.date, uhrzeit: null }, { now, lang });
      const again = await renderAvailability(answer, { ...state, stage: "time", draft: { ...d, time: null } }, deps, now);
      const taken = lang === "de" ? "Diese Zeit wurde gerade vergeben." : "That time has just been taken.";
      return { ...again, reply: `${taken} ${again.reply}` };
    }
    case "too_many":
      return say({ ...state, stage: "done" }, T.dailyLimit, { links: practiceLink(lang) });
    case "rate_limited":
      return say({ ...state, stage: "done" }, T.rateLimited, { links: practiceLink(lang) });
    case "not_live":
    case "paused": {
      const banner = outcome.banner?.trim();
      return say({ ...state, stage: "idle" }, banner ? `${banner} ${T.bookNotPossible}` : T.bookNotPossible, { links: practiceLink(lang) });
    }
    default:
      return say({ ...state, stage: "idle" }, T.bookNotPossible, { links: practiceLink(lang) });
  }
}

// --------------------------------------------------------- Praxisfragen

async function answerTopics(topics: Topic[], state: ChatState, deps: ChatDeps, question: string | null): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const live = await deps.info(lang);
  const answer = answerFromFacts(topics, lang, live);

  if (answer.facts.length === 0) {
    return say(state, T.unknownTopic, { quick: quick(lang, ["callback", "book"]), links: practiceLink(lang) });
  }

  let reply = answer.text;
  let llm: ChatResponse["flags"]["llm"] = "none";
  if (question) {
    const phrased = await deps.phrase(groundPrompt(question, answer.facts, lang));
    if (phrased && groundingCheck(phrased, answer.facts)) {
      reply = phrased.trim();
      llm = "model";
    } else {
      // Kein Modell erreichbar oder Antwort nicht gedeckt – der Faktentext gilt.
      llm = "fallback";
    }
  }
  if (answer.unknown.length) reply = `${reply} ${T.unknownTopic}`;
  return say(state, reply, { quick: quick(lang, ["book", "hours", "directions"]), flags: { llm } });
}

// ------------------------------------------------- Modell als Hinweis

async function classifyAndRoute(text: string, masked: string, state: ChatState, deps: ChatDeps, now: Date): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const types = await deps.types();
  const view: ModelView = {
    stage: state.stage,
    lang,
    text: masked,
    typeLabels: types.map((x) => x.label),
    today: isoDay(now),
    weekday: fmtLongDateLocale(now, lang).split(",")[0]!,
  };
  const raw = await deps.classify(classifyPrompt(view));
  const cls = raw ? parseClassification(raw) : null;

  if (!cls) {
    const failures = state.failures + 1;
    if (failures >= 2) {
      return say({ ...state, intent: "handover", failures: 0 }, T.handover, {
        quick: quick(lang, ["callback"]),
        links: practiceLink(lang),
        flags: { handover: true, llm: "fallback" },
      });
    }
    return say({ ...state, failures }, raw === null ? T.llmDown : T.notUnderstood, {
      quick: quick(lang, ["book", "hours", "directions"]),
      flags: { llm: "fallback" },
    });
  }

  // Das Modell darf einordnen, aber nichts erfinden: Datum und Uhrzeit
  // gelten nur, wenn die eigenen Parser sie im Text ebenfalls finden.
  const ownDate = parseDateWords(text, now, lang);
  const ownTime = parseTimeWords(text);
  const date = cls.date && cls.date === ownDate ? cls.date : ownDate;
  const time = cls.time && cls.time === ownTime ? cls.time : ownTime;
  const next: ChatState = { ...state, failures: 0, lang: cls.lang };
  const flags = { llm: "model" as const };

  switch (cls.intent) {
    case "booking":
      return withLlm(await startBooking(next, deps, now, cls.type ? `${text} ${cls.type}` : text, date, time), flags);
    case "hours":
      return withLlm(await answerTopics(["oeffnungszeiten"], next, deps, masked), flags);
    case "directions":
      return withLlm(await answerTopics(["anfahrt", "adresse"], next, deps, masked), flags);
    case "handover":
      return say({ ...next, intent: "handover" }, T.handover, { quick: quick(lang, ["callback"]), links: practiceLink(lang), flags: { ...flags, handover: true } });
    case "forward": {
      const kind = forwardKind(text);
      return say({ ...next, stage: "callback", intent: "forward", callbackKind: kind }, T.forward, {
        form: callbackForm(lang, kind),
        flags: { ...flags, handover: true },
      });
    }
    case "yes":
      return withLlm(next.stage === "confirm" ? await book(next, deps, now) : notUnderstood(next), flags);
    case "no":
      return withLlm(
        next.stage === "confirm"
          ? say({ ...next, stage: "date", draft: { ...next.draft, date: null, time: null } }, T.changed, { quick: quick(lang, ["nextfree"]) })
          : notUnderstood(next),
        flags,
      );
    case "info": {
      const topics = cls.topics.length ? findTopics(cls.topics.join(" "), lang) : [];
      if (topics.length) return withLlm(await answerTopics(topics, next, deps, masked), flags);
      return say(next, T.unknownTopic, { quick: quick(lang, ["callback", "book"]), links: practiceLink(lang), flags });
    }
    default:
      return withLlm(notUnderstood({ ...next, failures: state.failures + 1 }), flags);
  }
}

function notUnderstood(state: ChatState): ChatResponse {
  const T = t(state.lang);
  if (state.failures >= 2) {
    return say({ ...state, intent: "handover", failures: 0 }, T.handover, {
      quick: quick(state.lang, ["callback"]),
      links: practiceLink(state.lang),
      flags: { handover: true },
    });
  }
  return say(state, T.notUnderstood, { quick: quick(state.lang, ["book", "hours", "directions"]) });
}

function withLlm(res: ChatResponse, flags: { llm: "model" }): ChatResponse {
  return { ...res, flags: { ...res.flags, llm: res.flags.llm === "none" ? flags.llm : res.flags.llm } };
}

function isoDay(now: Date): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(now);
}
