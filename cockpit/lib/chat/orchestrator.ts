import { z } from "zod";
import { PRACTICE } from "../practice.ts";
import { addDays, fmtLongDateLocale } from "../time.ts";
import { detectForeign, detectForeignEmergency, FOREIGN_TEXTS, type ForeignLang } from "./foreign.ts";
import { answerFromFacts, findTopics, groundingCheck, SERVICE_TERMS, type LiveFacts, type Topic } from "./knowledge.ts";
import { detectLanguage, type Lang } from "./language.ts";
import type { LlmCall } from "./llm.ts";
import { classifyPrompt, groundPrompt, parseClassification, type ModelView } from "./prompts.ts";
import { detectEmergency, detectHealthData, isAcuteConcern, maskPii } from "./safety.ts";
import { matchType, renderSlotAnswer, typeTerms, type SlotAnswer, type ToolContext } from "./tools.ts";
import { parseDate, parseTime } from "./datetime.ts";
import { normalize } from "./normalize.ts";
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
 *
 * Reihenfolge im freien Text – sie ist das Ergebnis echter Fehler:
 *   Fremdsprache → Gesundheitsangaben → Übergabe/Weiterleitung →
 *   Antwort auf die gestellte Frage → Terminverwaltung → Akutes →
 *   Fragen aus dem Wissen → Terminwunsch → Wissen → Modell.
 * Fragen kommen VOR dem Terminwunsch, weil „Wie lange dauert ein Termin?“
 * sonst eine Buchung startet. Verwaltung kommt VOR dem Terminwunsch, weil
 * „Termin verschieben“ sonst einen zweiten Termin erzeugt.
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

/** Ein Zeitfenster innerhalb eines Tages, beide Grenzen als „HH:MM". */
export interface Window {
  from: string;
  to: string;
}

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
    /**
     * Gewünschtes Zeitfenster („nur nachmittags“, „nach 16 Uhr“). Es
     * gilt für die Suche, nicht für die Buchung – gebucht wird immer
     * eine genaue Uhrzeit. Ältere Zustände ohne dieses Feld bleiben
     * gültig; der Vorgabewert ist „kein Fenster“.
     */
    window: z.object({ from: z.string().regex(timeRe), to: z.string().regex(timeRe) }).nullable().default(null),
    /** Welche Seite der Zeiten eines Tages gerade gezeigt wird. */
    page: z.number().int().min(1).max(20).default(1),
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
  /** Vom Patienten ausdrücklich gewählte Sprache – sie gewinnt gegen die Erkennung. */
  lang: z.enum(["de", "en"]).optional(),
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
    /** Die Sprache wurde aus der Nachricht erkannt und gewechselt. */
    langDetected?: true;
    /** Nachricht in einer Sprache, die der Chat nicht spricht – fester Satz, kein Modell. */
    foreign?: ForeignLang;
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
  availability(
    args: { art: string; datum?: string | null; uhrzeit?: string | null; fenster?: Window | null; seite?: number | null },
    ctx: ToolContext,
  ): Promise<SlotAnswer>;
  nextFree(args: { art: string; fenster?: Window | null; ab?: string | null; bis?: string | null }, ctx: ToolContext): Promise<SlotAnswer>;
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
    draft: { typeId: null, date: null, time: null, contact: null, window: null, page: 1 },
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

const BOOKING_STAGES: Stage[] = ["type", "date", "time", "contact", "confirm"];

// -------------------------------------------------------- Bausteine UI

type QuickId =
  | "book"
  | "hours"
  | "directions"
  | "yes"
  | "no"
  | "callback"
  | "nextfree"
  | "other"
  | "again"
  | "myAppointment"
  | "changeDate"
  | "changeTime"
  | "changeType"
  | "changeContact"
  | "takeIt"
  | "later"
  | "earlier";

function quick(lang: Lang, ids: QuickId[]): QuickReply[] {
  const q = t(lang).quick;
  return ids.map((id) => ({ id, label: q[id] }));
}

/** Die vier Wege aus einer Zusammenfassung heraus. */
function changeQuick(lang: Lang): QuickReply[] {
  return quick(lang, ["changeDate", "changeTime", "changeType", "changeContact"]);
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

/** Einen Satz voranstellen, ohne den Rest der Antwort zu verändern. */
function prefixed(res: ChatResponse, sentence: string): ChatResponse {
  return { ...res, reply: `${sentence} ${res.reply}` };
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
  /(mit (?:einem |einer )?(?:menschen?|mitarbeiter|mensch)|echte[rn]? mensch|jemanden sprechen|jemand sprechen|persönlich sprechen|mit dem team|mitarbeiterin|rezeption|sprechstundenhilfe|(?:die|der|mit der) praxis sprechen|verbinden|durchstellen|zurückruf|zurueckruf|rückruf|rueckruf|(?<!\p{L})(?:kein(?:en)? )?bot(?!\p{L})|roboter|automat(?!isch)|speak (?:to|with) (?:a )?(?:human|someone|somebody|person|staff|the practice|the team)|talk to (?:a )?(?:human|someone|somebody|person|the practice|the team)|real (?:person|human)|human being|call (?:me )?back|callback)/iu;
const FORWARD_RE =
  /(rezept|folgerezept|krankschreibung|krankmeldung|arbeitsunfähig|attest|befund|überweisung|ueberweisung|prescription|sick note|sick leave|medical certificate|referral|findings|test results)/iu;
/** „Brauche ich eine Überweisung?“ ist eine Frage, keine Bitte um Weiterleitung. */
const ASKS_WHETHER_RE =
  /(brauche ich|brauch ich|braucht man|benötige ich|benoetige ich|muss ich|ist eine|ist ein |nötig|noetig|erforderlich|ohne (?:eine |die |meine )?(?:überweisung|ueberweisung)|reicht (?:eine|die|meine|auch eine)?\s*(?:überweisung|ueberweisung)|geht (?:das|es) (?:auch )?ohne|do i need|is a |is an |necessary|required|without (?:a |the |my )?referral|need a referral)/iu;
const BOOKING_RE =
  /(termin|buchen|vereinbaren|sprechstunde bekommen|vorstellen|vorbeikommen|vorbei kommen|reinkommen|appointment|book|booking|schedule|see the doctor|see dr|see a doctor|come in|come by|consultation|visit)/iu;
/**
 * Ein reines Ja – und nur das bucht. „Ja, aber um 15 Uhr“ ist kein Ja,
 * sondern eine Korrektur; sie wurde früher als Zusage gelesen und buchte
 * die falsche Zeit.
 */
const YES_CORE = new Set([
  "ja", "jaa", "jawohl", "jo", "jup", "jupp", "jap", "jep", "yep", "yeah", "yes", "y", "ok", "okay", "oki", "okey", "genau", "gern", "gerne",
  "passt", "richtig", "stimmt", "korrekt", "klar", "natürlich", "natuerlich", "sicher", "buchen", "buch", "verbindlich", "bestätigen",
  "bestaetigen", "bestätige", "bestaetige", "einverstanden", "absolut", "sure", "correct", "right", "book", "confirm", "confirmed",
  "absolutely", "definitely", "fine", "perfect", "great", "exactly", "agreed", "yup",
]);
const YES_FILLER = new Set([
  "bitte", "so", "das", "alles", "ist", "gut", "super", "prima", "machen", "wir", "ich", "es", "den", "termin", "nehme", "nehmen",
  "danke", "dankeschön", "dankeschoen", "vielen", "dank", "und", "please", "do", "go", "ahead", "it", "that", "is", "thanks", "thank",
  "you", "sounds", "good", "the", "appointment", "take", "let", "lets", "let's", "with", "this", "one", "then",
]);
const NOT_YES = new Set([
  "nein", "nicht", "kein", "keine", "aber", "lieber", "doch", "anders", "andere", "anderen", "anderer", "ändern", "aendern", "statt",
  "no", "not", "but", "rather", "other", "another", "change", "instead", "different", "don't", "dont", "nope", "nee", "nö", "ne",
]);
/** „Jaaa 👍“, „Jo, buchen“, „sure, go ahead“ – ein Ja ohne jede Einschränkung. */
function isBareYes(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/(\p{L})\1{2,}/gu, "$1"));
  if (!words.length || words.length > 8) return false;
  let core = false;
  for (const w of words) {
    if (NOT_YES.has(w)) return false;
    if (YES_CORE.has(w)) core = true;
    else if (!YES_FILLER.has(w)) return false;
  }
  return core;
}
/** Beginnt mit Ja, geht aber weiter – Absicht unklar, also nachfragen. */
const YES_START_RE = /^(ja|jawohl|yes|ok|okay|genau|gern|gerne|sure)\b/iu;
const NO_RE =
  /^(nein|nee|nö|ne\b|nicht|lieber (?:doch )?nicht|doch nicht|eher nicht|ändern|aendern|anders|no|nope|rather not|not really|no thanks|change|not quite)\b/iu;
/** Absagen, verschieben, bestätigen – in jeder Phase eine Verwaltungsabsicht. */
const MANAGE_VERB_RE =
  /(?<!\p{L})(absag|stornier|cancel|verschieb|umbuch|reschedul|move my appointment|change my appointment|bestätig\p{L}*(?:\s+ich)?\s+(?:den\s+|meinen\s+|my\s+)?termin|confirm my appointment|termin\s+(?:nehme|nehm)\s+ich\s+wahr|nehme ich wahr|sag\p{L}*\s+(?:ich\s+)?(?:einen\s+|den\s+|meinen\s+)?termin\s+ab(?!\p{L})|termin\s+ab(?:zu)?sagen|i'?ll be there|i will (?:be there|attend))/iu;
/** „Wann ist mein Termin?“, „Ich kann morgen nicht kommen“ – außerhalb einer laufenden Buchung eine Nachfrage zu einem bestehenden Termin. */
const MANAGE_LOOKUP_RE =
  /(wann ist mein(?:e)? termin|wann habe ich (?:meinen |einen )?termin|mein(?:en|em)? termin|my appointment|when is my appointment|habe ich (?:\p{L}+\s+){0,4}(?:schon |bereits )?(?:einen |den )?termin|ob ich (?:\p{L}+\s+){0,5}termin habe|do i have an appointment|am i booked|(?:what time|when) (?:am i|i'?m) booked|check (?:what time|when|if|whether) i|kann (?:ich )?(?:\p{L}+\s+){0,3}(?:leider )?nicht (?:kommen|erscheinen)|schaffe (?:es |ich es )?(?:\p{L}+\s+){0,3}nicht|can'?t (?:make it|come|attend)|cannot (?:make it|come|attend)|won'?t be able to (?:come|make it|attend)|change the (?:date|time|appointment)|move (?:my|the) appointment)/iu;
/**
 * Fachwörter, die in einer **Frage** keine Gesundheitsangabe sind, sondern
 * die Frage nach dem Angebot: „Machen Sie eine Darmspiegelung?“ schildert
 * keine Beschwerden. In einer Aussage („Ich hatte eine Operation“) bleibt
 * dasselbe Wort eine Gesundheitsangabe – deshalb gilt diese Liste nur für
 * Fragen.
 *
 * „surgery“ steht nur hier und nicht in `SERVICE_TERMS`: Im britischen
 * Englisch ist „surgery“ die Sprechstunde, „open surgery hours“ also keine
 * Leistungsfrage.
 */
const SERVICE_ASK_TERMS = [...SERVICE_TERMS, "surgery", "surgeries"];

/**
 * Ein ausdrücklicher Terminwunsch, auch mitten in einer Frage: „Ich hätte
 * gern einen Termin, und wie komme ich zu Ihnen?“ ist beides – die Frage
 * wird beantwortet, und die Buchung beginnt trotzdem.
 *
 * Bewusst eng: „Muss ich vorher einen Termin machen?“ fragt nach der Regel
 * und ist kein Wunsch. Deshalb fehlen „Termin machen“ und „einen Termin“ –
 * sie würden aus jeder Frage über Termine eine Buchung machen.
 */
const BOOKING_WISH_RE =
  /(?:ich\s+(?:möchte|moechte|will|hätte|haette|brauche|bräuchte|braeuchte|suche)[^?!.]{0,40}termin|termin\s+(?:vereinbaren|buchen|ausmachen)|i(?:'d| would)? ?(?:like|want|need)[^?!.]{0,40}appointment|(?:book|schedule)\s+an?\s+appointment)/iu;

/** Frageform: erst im Wissen nachsehen, bevor ein Wort wie „Termin“ eine Buchung startet. */
const QUESTION_RE =
  /^\s*(?:hallo|hi|moin|guten (?:tag|morgen|abend)|hello|good (?:morning|afternoon|evening))?[,.!\s]*(wie|wann|wo|was|welche|welcher|welches|ob|kann ich|kann man|könnte ich|koennte ich|darf ich|muss ich|brauche ich|gibt es|haben sie|habt ihr|hat die|ist |sind |do you|can i|could i|may i|how|what|when|where|is there|are you|will i|does|does (?:the|dr|your)|is it|are there|will i|would you|could you)\b|.*\?\s*$/iu;

const FORWARD_KIND: Array<{ kind: CallbackKind; re: RegExp }> = [
  { kind: "folgerezept", re: /(rezept|prescription)/iu },
  { kind: "ueberweisung", re: /(überweisung|ueberweisung|referral)/iu },
  { kind: "befundkopie", re: /(befund|findings|test results)/iu },
  { kind: "sonstiges", re: /(krankschreibung|krankmeldung|arbeitsunfähig|attest|sick note|sick leave|medical certificate)/iu },
];

function forwardKind(text: string): CallbackKind {
  return FORWARD_KIND.find((x) => x.re.test(text))?.kind ?? "rueckruf";
}

// ------------------------------------------------- Wann soll es sein?

/**
 * Was ein Satz über den Zeitpunkt verrät – alles, was `datetime.ts`
 * herausliest, in einer Form, mit der der Ablauf arbeiten kann.
 */
interface When {
  /** Ein bestimmter Tag. */
  date: string | null;
  /** Eine genaue Uhrzeit. */
  time: string | null;
  /** Ein Zeitfenster („nachmittags", „nach 16 Uhr"). */
  window: Window | null;
  /** „so früh wie möglich" – der früheste freie Platz. */
  earliest: boolean;
  /** Samstag oder Sonntag: Da ist geschlossen. */
  weekend: boolean;
  /** Ein Zeitraum („nächste Woche", „Anfang Oktober"), von … bis. */
  from: string | null;
  to: string | null;
}

const NO_WHEN: When = { date: null, time: null, window: null, earliest: false, weekend: false, from: null, to: null };

/**
 * Erst der geschriebene Satz, dann – falls der nichts hergibt – der
 * begradigte. So gewinnt immer das, was wirklich dasteht, und ein
 * Tippfehler („Donerstag") bekommt trotzdem seine Chance.
 */
function readWhen(text: string, now: Date, lang: Lang): When {
  if (!text.trim()) return NO_WHEN;
  const norm = normalize(text);
  const second = norm === text.toLowerCase() ? null : norm;
  const d = parseDate(text, now, lang) ?? (second ? parseDate(second, now, lang) : null);
  const h = parseTime(text, lang) ?? (second ? parseTime(second, lang) : null);
  const window = h && h.from && h.to ? { from: h.from, to: h.to } : null;
  return {
    date: d?.kind === "day" ? (d.date ?? null) : null,
    time: h?.kind === "exact" ? (h.time ?? null) : null,
    window,
    earliest: h?.kind === "earliest",
    weekend: d?.kind === "weekend",
    from: d?.kind === "range" ? (d.from ?? null) : null,
    to: d?.kind === "range" ? (d.to ?? null) : null,
  };
}

/** Steht im Satz überhaupt ein Terminwunsch? */
function hasWish(w: When): boolean {
  return Boolean(w.date || w.time || w.window || w.earliest || w.from || w.weekend);
}

/**
 * Welches Fenster gilt jetzt? Eine genannte genaue Uhrzeit hebt ein
 * früheres Fenster auf – wer erst „nachmittags" sagt und dann „geht auch
 * neun Uhr?", bekommt sonst zur Antwort, neun Uhr sei belegt.
 */
function windowFor(when: When, draft: ChatState["draft"]): Window | null {
  if (when.time) return null;
  return when.window ?? draft.window;
}

/**
 * Nachfragen zu einer Liste von Zeiten. Sie stehen bewusst vor der
 * Fenster-Erkennung: „Das ist zu früh, was ist danach noch frei?" enthält
 * das Wort „früh" und wäre sonst ein Vormittagswunsch.
 */
const LATER_RE = /(?<!\p{L})(?:sp(?:ä|ae)ter\p{L}*|danach|nach hinten|later|after that|after those)(?!\p{L})/iu;
const EARLIER_RE = /(?<!\p{L})(?:fr(?:ü|ue)her\p{L}*|vorher|earlier|before that)(?!\p{L})/iu;
const NONE_RE =
  /(?<!\p{L})(?:nichts davon|nichts passt|keins? davon|keine davon|keine[rs]? passt|geht alles nicht|passt (?:alles )?nicht|was anderes|etwas anderes|something else|none of (?:those|them|these)|nothing (?:works|fits|suits)|(?:that |these |those )?do(?:es)?n'?t work)/iu;
const OTHER_DAY_RE = /(?<!\p{L})(?:ander(?:er|en|em) tag|anderes datum|another day|other day|different day)(?!\p{L})/iu;

// -------------------------------------------------------------- Ablauf

/** Alles, was die Patientin in diesem Zug geschrieben hat – auch in Formularfeldern. */
export function collectText(req: ChatRequest): string {
  return [req.message ?? "", ...Object.values(req.action?.kind === "form" ? req.action.values : {})].join("\n");
}

/** Notfall? Diese Prüfung braucht weder Datenbank noch Modell noch Zustand. */
export function isEmergency(req: ChatRequest): boolean {
  const text = collectText(req);
  if (detectEmergency(text)) return true;
  const foreign = detectForeign(text);
  return foreign !== null && detectForeignEmergency(text, foreign);
}

/** Der geprüfte Zustand aus der Anfrage – manipuliertes wird verworfen, ausdrückliche Sprache gilt. */
export function stateFor(req: ChatRequest): ChatState {
  const state = reviveState(req.state, req.lang ?? detectLanguage(req.message ?? "", "de").lang);
  return req.lang && req.lang !== state.lang ? { ...state, lang: req.lang } : state;
}

/**
 * Die Notfallantwort. Sie steht bewusst als eigene Funktion da: Die Route
 * gibt sie aus, bevor gezählt, geprüft oder abgeschaltet wird – 112 muss
 * auch dann erscheinen, wenn der Chat pausiert oder das Limit erreicht ist.
 * In einer Sprache, die der Chat nicht spricht, kommt der Notfallsatz
 * trotzdem in dieser Sprache.
 */
export function emergencyReply(state: ChatState, text = ""): ChatResponse {
  const foreign = text ? detectForeign(text) : null;
  const reply = foreign ? FOREIGN_TEXTS[foreign].emergency : t(state.lang).emergency;
  return say({ ...state, stage: "idle", failures: 0 }, reply, {
    links: telLinks(state.lang),
    flags: foreign ? { emergency: true, foreign } : { emergency: true },
  });
}

export async function runTurn(req: ChatRequest, deps: ChatDeps): Promise<ChatResponse> {
  const now = deps.now();
  let state = stateFor(req);
  state = { ...state, turns: Math.min(state.turns + 1, 500) };

  // 1. Notfall geht allem voraus – auch dem, was in einem Formularfeld steht.
  if (isEmergency(req)) {
    deps.audit("chat.emergency");
    return emergencyReply(state, collectText(req));
  }

  if (req.action?.kind === "form") return handleForm(req.action, state, deps);
  if (req.action?.kind === "quick") return handleQuick(req.action.id, state, deps, now);

  const text = (req.message ?? "").trim();
  if (!text) return say(state, t(state.lang).notUnderstood, { quick: quick(state.lang, ["book", "hours", "directions"]) });
  return handleMessage(text, state, deps, now, { explicitLang: Boolean(req.lang), fresh: req.state == null });
}

// -------------------------------------------------------- Freier Text

async function handleMessage(
  text: string,
  prev: ChatState,
  deps: ChatDeps,
  now: Date,
  opts: { explicitLang: boolean; fresh: boolean },
): Promise<ChatResponse> {
  // 0. Eine Sprache, die der Chat nicht spricht: fester Satz in dieser
  //    Sprache, kein Modell, keine weitere Verarbeitung. Der Text könnte
  //    Gesundheitsangaben enthalten, die kein Filter dieser Datei erkennt.
  const foreign = detectForeign(text);
  if (foreign) {
    deps.audit("chat.foreign", { lang: foreign });
    const F = FOREIGN_TEXTS[foreign];
    return say({ ...prev, failures: 0 }, F.reply, {
      quick: [
        { id: "book", label: F.quickBook },
        { id: "hours", label: F.quickHours },
      ],
      links: practiceLink(prev.lang),
      flags: { foreign },
    });
  }

  // Ohne Vorgabe darf die Erkennung umschalten – nur bei hoher Sicherheit.
  // Ein frischer Zustand trägt die erkannte Sprache schon (stateFor), die
  // Oberfläche erfährt es trotzdem, damit sie ihre Beschriftung anpasst.
  const guess = detectLanguage(text, prev.lang);
  const detected =
    !opts.explicitLang && guess.confidence === "high" && (guess.lang !== prev.lang || (opts.fresh && guess.lang !== "de"));
  const state: ChatState = detected ? { ...prev, lang: guess.lang } : prev;
  const res = await handleText(text, state, deps, now);
  return detected ? { ...res, flags: { ...res.flags, langDetected: true } } : res;
}

async function handleText(text: string, state: ChatState, deps: ChatDeps, now: Date): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const types = await deps.types();
  // Der begradigte Satz: Umlaute gefaltet, Wendungen ersetzt, Tippfehler
  // gegen eine kleine Wortliste korrigiert. Er dient ausschließlich dem
  // Erkennen – angezeigt und gespeichert wird immer das Geschriebene.
  const norm = normalize(text);
  const named = matchType(text, types, lang) ?? matchType(norm, types, lang);
  const namedType = named && types.some((x) => x.id === named) ? named : null;
  // Die Frageform entscheidet mit, was als Gesundheitsangabe gilt.
  const isQuestion = QUESTION_RE.test(text) || QUESTION_RE.test(norm);
  // 1. Gesundheitsangaben: Hinweis statt Verarbeitung – das Modell sieht
  //    diesen Text nicht, und gespeichert wird er auch nicht. Die Namen
  //    der buchbaren Terminarten zählen nicht als Gesundheitsangabe.
  const health = detectHealthData(text, { ignore: isQuestion ? [...typeTerms(types), ...SERVICE_ASK_TERMS] : typeTerms(types) });
  const acute = isAcuteConcern(text, health !== null);
  if (health?.medicalQuestion) {
    deps.audit("chat.health_filtered", { medicalQuestion: true });
    return say({ ...state, failures: 0 }, T.medicalRefusal, { quick: quick(lang, ["book", "callback"]) });
  }
  // „Bitte schicken Sie den Befund an meinen Hausarzt“: eine Weiterleitung,
  // kein Gespräch über Gesundheit – das Formular kommt, der Text wird nicht
  // verarbeitet (eine Schilderung im Formular wird dort verworfen).
  if (health && FORWARD_RE.test(text) && !ASKS_WHETHER_RE.test(text)) {
    deps.audit("chat.health_filtered", { medicalQuestion: false });
    const kind = forwardKind(text);
    return say({ ...state, stage: "callback", intent: "forward", callbackKind: kind, failures: 0 }, T.forward, {
      form: callbackForm(lang, kind),
      links: practiceLink(lang),
      flags: { handover: true },
    });
  }
  if (health) {
    deps.audit("chat.health_filtered", { medicalQuestion: false });
    if (namedType) {
      // Terminart genannt und dazu etwas Gesundheitliches: Die Wahl gilt,
      // der Hinweis (oder bei Akutem der Anruf-Hinweis) kommt dazu, Tag
      // und Uhrzeit gehen nicht verloren.
      const when = readWhen(text, now, lang);
      const next: ChatState = {
        ...state,
        failures: 0,
        draft: { ...state.draft, date: when.date ?? state.draft.date, time: when.time ?? state.draft.time, window: windowFor(when, state.draft) },
      };
      return prefixed(await afterType(namedType, next, deps, now, "", when), acute ? T.acute : T.healthHintShort);
    }
    // Akut, aber kein Notfall: kurzfristige Termine gibt es per Telefon –
    // kein Rat, keine Einschätzung, keine Ermahnung.
    if (acute) {
      return say({ ...state, failures: 0 }, T.acute, { quick: quick(lang, ["book", "callback"]), links: practiceLink(lang) });
    }
    if (state.stage === "type") {
      return say({ ...state, failures: 0 }, `${T.healthHint} ${T.askType}`, { quick: typeQuick(types) });
    }
    return say({ ...state, failures: 0 }, T.healthHint, { quick: quick(lang, ["book", "hours", "directions"]) });
  }

  // 2. Ab hier darf ein Modell mitreden – aber nur maskiert.
  const masked = maskPii(text);
  if (masked.masked.length) deps.audit("chat.masked", { kinds: masked.masked });
  // „Machen Sie eine Darmspiegelung?“ darf beantwortet werden – aber der
  // Satz selbst geht trotzdem nicht zum Modell. Er nennt ein Verfahren, und
  // die kostenlosen Anbieter haben keinen Auftragsverarbeitungsvertrag.
  // Die Antwort ist dann der gepflegte Faktentext, unformuliert.
  const askText = detectHealthData(text) === null ? masked.text : null;
  if (askText === null) deps.audit("chat.health_filtered", { medicalQuestion: false, kept: "leistungsfrage" });

  // 3. Wünsche, die in jedem Schritt gelten
  if (HANDOVER_RE.test(text) || HANDOVER_RE.test(norm)) {
    const hours = (await deps.info(lang)).hoursText;
    return say({ ...state, intent: "handover", failures: 0 }, `${T.handover} ${hoursSentence(lang, hours)}`, {
      quick: quick(lang, ["callback"]),
      links: practiceLink(lang),
      flags: { handover: true },
    });
  }
  if ((FORWARD_RE.test(text) || FORWARD_RE.test(norm)) && !ASKS_WHETHER_RE.test(text)) {
    const kind = forwardKind(text) === "rueckruf" ? forwardKind(norm) : forwardKind(text);
    return say({ ...state, stage: "callback", intent: "forward", callbackKind: kind, failures: 0 }, T.forward, {
      form: callbackForm(lang, kind),
      links: practiceLink(lang),
      flags: { handover: true },
    });
  }

  // 4. Antwort auf die gerade gestellte Frage
  switch (state.stage) {
    case "confirm":
      return confirmStage(text, state, deps, now, namedType);
    case "type": {
      if (namedType) return afterType(namedType, { ...state, failures: 0 }, deps, now, text);
      break;
    }
    case "date":
    case "time": {
      const when = readWhen(text, now, lang);
      const ready: ChatState = { ...state, failures: 0 };
      if (when.weekend) return weekendReply(ready, deps);
      // Ein genannter Tag gewinnt gegen jede Nachfrage: „und Donnerstag?"
      // ist keine Bitte um spätere Zeiten, sondern ein anderer Tag.
      if (when.date) {
        return checkSlot(ready, deps, now, when.date, when.time, { window: windowFor(when, state.draft), page: 1 });
      }
      if (when.earliest || when.from) return askEarliest(ready, deps, now, when);
      // Nachfragen vor der Fenster-Erkennung – „zu früh" ist kein Vormittag.
      if (state.draft.date && LATER_RE.test(text)) {
        return checkSlot(ready, deps, now, state.draft.date, null, { page: state.draft.page + 1, wanted: state.draft.page + 1 });
      }
      if (state.draft.date && EARLIER_RE.test(text)) {
        const page = Math.max(1, state.draft.page - 1);
        return checkSlot(ready, deps, now, state.draft.date, null, { page, wanted: state.draft.page - 1 });
      }
      if (when.time || when.window) {
        return checkSlot(ready, deps, now, state.draft.date, when.time, { window: windowFor(when, state.draft), page: 1 });
      }
      // „Nichts davon passt", „anderer Tag" – weiter suchen, nicht raten.
      if (NONE_RE.test(text) || OTHER_DAY_RE.test(text)) {
        const ab = state.draft.date ? addDays(state.draft.date, 1) : null;
        return askEarliest(ready, deps, now, { ...NO_WHEN, from: ab, window: state.draft.window });
      }
      break;
    }
    default:
      break;
  }

  // 5. Terminverwaltung – vor dem Terminwunsch, sonst wird aus
  //    „Termin verschieben“ ein zweiter Termin.
  const inBooking = BOOKING_STAGES.includes(state.stage);
  const manageVerb = MANAGE_VERB_RE.test(text) || MANAGE_VERB_RE.test(norm);
  if (manageVerb || (!inBooking && (MANAGE_LOOKUP_RE.test(text) || MANAGE_LOOKUP_RE.test(norm)))) {
    return manageStub({ ...state, failures: 0 }, deps);
  }

  // 6. Terminwunsch im freien Satz – und Fragen zuerst aus dem Wissen
  const when = readWhen(text, now, lang);
  // Eine genannte Terminart („Ich glaube, ich habe Hämorrhoiden“) ist ein
  // Terminwunsch – außer in einer Frage, die zuerst das Wissen beantwortet.
  // Ein nackter Tag, eine Uhrzeit oder ein Tagesteil („Dienstag 14:30“,
  // „Geht Montag?“, „lieber nachmittags“) ist ebenfalls ein Terminwunsch.
  const wantsBooking = BOOKING_RE.test(text) || BOOKING_RE.test(norm) || hasWish(when) || (namedType !== null && !isQuestion);

  // Am Wochenende ist geschlossen – das gilt vor jeder Terminsuche und
  // vor jeder Öffnungszeiten-Antwort, weil „Samstag?“ genau das fragt.
  if (when.weekend) return weekendReply({ ...state, failures: 0 }, deps);
  // „So früh wie möglich“ ist ein Wunsch, keine Wissensfrage – auch wenn
  // er als Frage formuliert ist („Was ist das Früheste, was Sie haben?“).
  if (when.earliest) {
    const res = await startBooking({ ...state, failures: 0 }, deps, now, text, when);
    return acute ? prefixed(res, T.acute) : res;
  }

  if (acute && !wantsBooking) {
    return say({ ...state, failures: 0 }, T.acute, { quick: quick(lang, ["book", "callback"]), links: practiceLink(lang) });
  }
  if (isQuestion) {
    const topics = topicsFor(text, norm, lang);
    if (topics.length) {
      // „Ich hätte gern einen Termin, und wie komme ich zu Ihnen?“ – erst
      // die Antwort, dann der Termin. Eine der beiden Absichten fallen zu
      // lassen wäre in beide Richtungen falsch.
      if (BOOKING_WISH_RE.test(text) || BOOKING_WISH_RE.test(norm)) {
        const info = await answerTopics(topics, { ...state, failures: 0 }, deps, askText);
        const res = await startBooking({ ...state, failures: 0 }, deps, now, text, when);
        return { ...res, reply: `${info.reply} ${res.reply}` };
      }
      return answerTopics(topics, { ...state, failures: 0 }, deps, askText);
    }
  }
  if (wantsBooking) {
    const res = await startBooking({ ...state, failures: 0 }, deps, now, text, when);
    return acute ? prefixed(res, T.acute) : res;
  }

  // 7. Frage zur Praxis – aus gepflegten Fakten, notfalls vom Modell formuliert
  const topics = topicsFor(text, norm, lang);
  if (topics.length) return answerTopics(topics, { ...state, failures: 0 }, deps, askText);

  // 8. Erst jetzt das Modell fragen – und nur als Hinweis. Enthält der Satz
  //    ein Fachwort, wird auch hier nicht gefragt: Dann ist die ehrliche
  //    Antwort „das weiß ich nicht“ besser als eine Einordnung, für die der
  //    Satz das Haus verlassen müsste.
  if (askText === null) {
    deps.audit("chat.unknown_topic", { topic: "frage" });
    return say({ ...state, failures: 0 }, T.unknownTopic, { quick: quick(lang, ["callback", "book"]), links: practiceLink(lang) });
  }
  return classifyAndRoute(text, askText, state, deps, now, isQuestion);
}

/**
 * Die Bestätigungsfrage. Nur ein reines Ja bucht. Jede erkennbare
 * Korrektur (anderer Tag, andere Uhrzeit, andere Terminart) wird
 * übernommen und erneut geprüft – die Kontaktdaten bleiben.
 */
async function confirmStage(text: string, state: ChatState, deps: ChatDeps, now: Date, namedType: string | null): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const d = state.draft;
  const when = readWhen(text, now, lang);
  const date = when.date;
  const time = when.time;
  const changedType = namedType && namedType !== d.typeId ? namedType : null;
  const changed = (date && date !== d.date) || (time && time !== d.time) || Boolean(when.window) || changedType;

  if (changed) {
    const next: ChatState = { ...state, failures: 0, draft: { ...d, typeId: changedType ?? d.typeId } };
    const newDate = date ?? d.date;
    const newTime = time ?? (date && date !== d.date ? null : when.window ? null : d.time);
    return checkSlot(next, deps, now, newDate, newTime, { window: windowFor(when, d), page: 1 });
  }
  if (isBareYes(text)) return book(state, deps, now);
  if (NO_RE.test(text) || YES_START_RE.test(text)) {
    return say({ ...state, failures: 0 }, T.whatToChange, { quick: changeQuick(lang) });
  }
  if (state.failures === 0) return say({ ...state, failures: 1 }, T.confirmAgain, { quick: quick(lang, ["yes", "no"]) });
  return say({ ...state, failures: 0 }, T.whatToChange, { quick: changeQuick(lang) });
}

/**
 * Terminverwaltung – bis die Verwaltung im Chat gebaut ist (Stufe 2D),
 * der ehrliche Weg: Link in der Bestätigungsmail oder Telefon.
 */
async function manageStub(state: ChatState, deps: ChatDeps): Promise<ChatResponse> {
  const res = await answerTopics(["absagen"], state, deps, null);
  return { ...res, quick: quick(state.lang, ["callback", "book"]), links: practiceLink(state.lang) };
}

function hoursSentence(lang: Lang, hoursText: string): string {
  return lang === "de" ? `Sprechzeiten: ${hoursText}.` : `Opening hours: ${hoursText}.`;
}

// ------------------------------------------------------ Schaltflächen

async function handleQuick(id: string, prev: ChatState, deps: ChatDeps, now: Date): Promise<ChatResponse> {
  const state: ChatState = { ...prev, failures: 0 };
  const lang = state.lang;
  const T = t(lang);

  if (id === "book" || id === "again") return startBooking(state, deps, now, "", NO_WHEN);
  if (id === "hours" || id === "directions") {
    const topics: Topic[] = id === "hours" ? ["oeffnungszeiten"] : ["anfahrt", "adresse"];
    return answerTopics(topics, state, deps, null);
  }
  if (id === "myAppointment") return manageStub(state, deps);
  if (id === "callback") {
    const kind = state.callbackKind ?? "rueckruf";
    return say({ ...state, stage: "callback", callbackKind: kind }, T.callbackIntro, { form: callbackForm(lang, kind) });
  }
  if (id === "nextfree") return askEarliest(state, deps, now, { ...NO_WHEN, earliest: true, window: state.draft.window });
  if (id === "later" || id === "earlier") {
    if (!state.draft.date) return say({ ...state, stage: "date" }, T.askDate, { quick: quick(lang, ["nextfree"]) });
    const wanted = id === "later" ? state.draft.page + 1 : state.draft.page - 1;
    return checkSlot(state, deps, now, state.draft.date, null, { page: Math.max(1, wanted), wanted });
  }
  if (id === "yes") return state.stage === "confirm" ? book(state, deps, now) : say(state, T.notUnderstood, { quick: quick(lang, ["book", "hours", "directions"]) });
  if (id === "no") return say(state, T.whatToChange, { quick: changeQuick(lang) });
  if (id === "changeDate" || id === "other") {
    return say({ ...state, stage: "date", draft: { ...state.draft, date: null, time: null, window: null, page: 1 } }, T.askDate, {
      quick: quick(lang, ["nextfree"]),
    });
  }
  if (id === "changeTime") {
    if (!state.draft.date) return say({ ...state, stage: "date", draft: { ...state.draft, time: null } }, T.askDate, { quick: quick(lang, ["nextfree"]) });
    return checkSlot({ ...state, draft: { ...state.draft, time: null } }, deps, now, state.draft.date, null, { window: null, page: 1 });
  }
  if (id === "changeType") {
    const types = await deps.types();
    return say({ ...state, stage: "type", draft: { ...state.draft, typeId: null } }, T.askType, { quick: typeQuick(types) });
  }
  if (id === "changeContact") {
    return say({ ...state, stage: "contact", draft: { ...state.draft, contact: null } }, T.askContact, { form: contactForm(lang) });
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
    return checkSlot(state, deps, now, date, null, { page: 1 });
  }
  if (id.startsWith("time:")) {
    const [date, time] = id.slice(5).split("|");
    if (!date || !time || !dateRe.test(date) || !timeRe.test(time)) return say(state, T.askTime);
    // Eine angeklickte Zeit ist eine genaue Zeit: Ein Fenster von vorher
    // darf sie nicht wegfiltern.
    return checkSlot(state, deps, now, date, time, { window: null, page: 1 });
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
  const dropped = noteHasHealth ? ` ${T.healthHintShort}` : "";
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
  when: When,
): Promise<ChatResponse> {
  const lang = state.lang;
  const types = await deps.types();
  if (types.length === 0) return say({ ...state, stage: "idle" }, t(lang).bookNotPossible, { links: practiceLink(lang) });

  const named = text ? (matchType(text, types, lang) ?? matchType(normalize(text), types, lang)) : null;
  const typeId = named && types.some((x) => x.id === named) ? named : state.draft.typeId;
  const window = windowFor(when, state.draft);
  const next: ChatState = {
    ...state,
    intent: "booking",
    draft: { ...state.draft, typeId, date: when.date ?? state.draft.date, time: when.time ?? state.draft.time, window },
  };

  if (!typeId) {
    // Ohne genannte Terminart nicht raten: Wenn schon ein Tag, eine Zeit
    // oder ein Fenster im Raum steht, wird es mit der allgemeinen
    // Terminart beantwortet – die Auswahl kommt trotzdem, denn danach
    // wird erneut geprüft.
    const fallback = types.find((x) => x.id === "unklar") ?? types[0]!;
    if (when.earliest || when.from) {
      const answer = await deps.nextFree({ art: fallback.id, fenster: window, ab: when.from, bis: when.to }, { now, lang });
      const sentence = renderSlotAnswer(answer, lang, fallback.label, phone, now);
      return say({ ...next, stage: "type" }, `${sentence} ${t(lang).askType}`, { quick: typeQuick(types) });
    }
    if (next.draft.date || next.draft.time || window) {
      const answer = await deps.availability(
        { art: fallback.id, datum: next.draft.date, uhrzeit: next.draft.time, fenster: window, seite: 1 },
        { now, lang },
      );
      const sentence = renderSlotAnswer(answer, lang, fallback.label, phone, now);
      return say({ ...next, stage: "type" }, `${sentence} ${t(lang).askType}`, { quick: typeQuick(types) });
    }
    return say({ ...next, stage: "type" }, t(lang).askType, { quick: typeQuick(types) });
  }
  return afterType(typeId, next, deps, now, text, when);
}

/**
 * „So früh wie möglich“ – und alles, was sich wie ein Zeitraum anhört
 * („nächste Woche“, „Anfang Oktober“). Beides ist dieselbe Frage an die
 * Verfügbarkeit: der erste freie Platz, gegebenenfalls eingegrenzt.
 */
async function askEarliest(state: ChatState, deps: ChatDeps, now: Date, when: When, typeId?: string): Promise<ChatResponse> {
  const lang = state.lang;
  const art = typeId ?? state.draft.typeId;
  if (!art) return startBooking(state, deps, now, "", when);
  const window = windowFor(when, state.draft);
  const answer = await deps.nextFree({ art, fenster: window, ab: when.from, bis: when.to }, { now, lang });
  const next: ChatState = {
    ...state,
    intent: "booking",
    stage: "date",
    draft: { ...state.draft, typeId: art, date: null, time: null, window, page: 1 },
  };
  return renderAvailability(answer, next, deps, now);
}

async function afterType(
  typeId: string,
  state: ChatState,
  deps: ChatDeps,
  now: Date,
  text: string,
  when: When = NO_WHEN,
): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const date = state.draft.date ?? when.date;
  const time = state.draft.time ?? when.time;
  const window = windowFor(when, state.draft);
  const next: ChatState = { ...state, intent: "booking", draft: { ...state.draft, typeId, date, time, window } };
  if (when.weekend) return weekendReply(next, deps);
  if (when.earliest || when.from) return askEarliest(next, deps, now, when, typeId);
  if (date) return checkSlot(next, deps, now, date, time, { window, page: 1 });
  // Ein Fenster ohne Tag („nur nachmittags“) ist trotzdem eine Auskunft
  // wert: die nächsten Tage, die in dieses Fenster passen.
  if (window) return checkSlot(next, deps, now, null, null, { window, page: 1 });
  // Aus freiem Text erkannt: kurz bestätigen, was verstanden wurde.
  const label = text ? (await deps.types()).find((x) => x.id === typeId)?.label : undefined;
  const reply = label ? `${T.typeNoted} ${label}. ${T.askDate}` : T.askDate;
  return say({ ...next, stage: "date" }, reply, { quick: quick(lang, ["nextfree"]) });
}

/** Verfügbarkeit fragen und daraus den nächsten Schritt ableiten. */
async function checkSlot(
  state: ChatState,
  deps: ChatDeps,
  now: Date,
  date: string | null,
  time: string | null,
  opts: { window?: Window | null; page?: number; wanted?: number } = {},
): Promise<ChatResponse> {
  const lang = state.lang;
  const window = opts.window === undefined ? state.draft.window : opts.window;
  if (!state.draft.typeId) return startBooking(state, deps, now, "", { ...NO_WHEN, date, time, window });
  const page = Math.max(1, opts.page ?? 1);
  const answer = await deps.availability({ art: state.draft.typeId, datum: date, uhrzeit: time, fenster: window, seite: page }, { now, lang });
  const next: ChatState = {
    ...state,
    draft: { ...state.draft, date, time: answer.kind === "time_free" ? time : null, window, page },
  };
  const res = await renderAvailability(answer, next, deps, now);
  // Ehrlich bleiben, wenn es die gewünschte Seite nicht gibt: Sonst
  // stünden dieselben Zeiten noch einmal da, als wären sie neu.
  if (opts.wanted !== undefined && answer.kind === "day_slots" && answer.page !== opts.wanted) {
    const T = t(lang);
    return { ...res, reply: `${opts.wanted > answer.page ? T.noLater : T.noEarlier} ${res.reply}` };
  }
  return res;
}

async function renderAvailability(answer: SlotAnswer, state: ChatState, deps: ChatDeps, now: Date): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const types = await deps.types();
  const label = types.find((x) => x.id === state.draft.typeId)?.label ?? "";
  const sentence = renderSlotAnswer(answer, lang, label, phone, now);

  switch (answer.kind) {
    case "time_free": {
      const draft = { ...state.draft, date: answer.date, time: answer.time };
      // Kontaktdaten schon da (Korrektur oder zweite Buchung): gleich die
      // Zusammenfassung – niemand tippt seinen Namen zweimal.
      if (draft.contact) {
        const next: ChatState = { ...state, stage: "confirm", draft };
        return say(next, `${sentence} ${T.contactReused} ${await summarySentence(next, deps)}`, { quick: quick(lang, ["yes", "no"]) });
      }
      const next: ChatState = { ...state, stage: "contact", draft };
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
        draft: { ...state.draft, date: answer.date, time: null, window: answer.window ?? state.draft.window, page: answer.page },
        lastOffer: answer.slots.map((time) => ({ date: answer.date, time })),
      };
      // Blättern nur anbieten, wenn es wirklich mehr gibt – ein Knopf,
      // der nichts Neues zeigt, ist eine Enttäuschung mit Klick.
      const more: QuickId[] = [];
      if (answer.hasMore) more.push("later");
      if (answer.hasEarlier) more.push("earlier");
      more.push("changeDate");
      return say(next, `${sentence} ${T.askTime}`, { quick: [...timeQuick(lang, answer.date, answer.slots), ...quick(lang, more)] });
    }
    case "earliest": {
      // Ein Satz, ein Klick: Der Knopf trägt Tag und Uhrzeit, der nächste
      // Zug prüft sie erneut und geht zum Kontaktformular.
      const next: ChatState = {
        ...state,
        stage: "time",
        draft: { ...state.draft, date: answer.date, time: null, page: 1 },
        lastOffer: [{ date: answer.date, time: answer.time }],
      };
      return say(next, sentence, {
        quick: [{ id: `time:${answer.date}|${answer.time}`, label: T.quick.takeIt }, ...quick(lang, ["changeDate", "changeTime"])],
      });
    }
    case "day_empty": {
      const next: ChatState = { ...state, stage: "date", draft: { ...state.draft, date: null, time: null, page: 1 } };
      return say(next, sentence, { quick: dayQuick(lang, answer.nextDays) });
    }
    case "next_days": {
      const next: ChatState = { ...state, stage: "date", draft: { ...state.draft, date: null, time: null, page: 1 } };
      return say(next, sentence, { quick: [...dayQuick(lang, answer.days), ...quick(lang, answer.days.length ? [] : ["callback"])] });
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
    // Der Entwurf wird geräumt, die Kontaktdaten bleiben: Ein zweiter
    // Termin in derselben Sitzung braucht kein Formular mehr.
    const done: ChatState = {
      ...state,
      stage: "done",
      intent: null,
      lastOffer: [],
      draft: { typeId: null, date: null, time: null, contact: d.contact, window: null, page: 1 },
    };
    return say(done, `${head} ${tail}`, {
      quick: quick(lang, ["again", "myAppointment"]),
      links: practiceLink(lang),
      flags: { booked: { ref: outcome.ref, mail: outcome.mail } },
    });
  }

  switch (outcome.code) {
    case "slot_taken": {
      const answer = await deps.availability({ art: d.typeId, datum: d.date, uhrzeit: null, fenster: null, seite: 1 }, { now, lang });
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
  const types = await deps.types();
  // Die Termindauer steht nicht im gepflegten Text, sondern je Terminart in
  // der Datenbank. Ist die Terminart im Gespräch schon genannt, wird ihre
  // Dauer genannt – sonst die Spanne über alle.
  const answer = answerFromFacts(topics, lang, {
    ...live,
    durations: types.map((x) => ({ label: x.label, durationMin: x.durationMin })),
    typeLabel: types.find((x) => x.id === state.draft.typeId)?.label ?? null,
  });
  // Was die Praxis nicht hinterlegt hat, wird gezählt – nur der Themenschlüssel, nie der Text.
  for (const topic of answer.unknown) deps.audit("chat.unknown_topic", { topic });

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

/**
 * Themen aus dem geschriebenen und aus dem begradigten Satz. Die Reihen-
 * folge des Geschriebenen gewinnt – sie bestimmt, welcher Faktentext
 * zuerst kommt; der begradigte Satz steuert nur bei, was sonst an einem
 * Tippfehler gescheitert wäre.
 */
function topicsFor(text: string, norm: string, lang: Lang): Topic[] {
  const found = findTopics(text, lang);
  for (const topic of findTopics(norm, lang)) if (!found.includes(topic)) found.push(topic);
  return found;
}

/**
 * „Geht auch am Samstag?“ – am Wochenende ist zu. Der Assistent sagt das
 * und bietet gleich einen Werktag an, statt eine leere Liste zu zeigen.
 */
async function weekendReply(state: ChatState, deps: ChatDeps): Promise<ChatResponse> {
  const res = await answerTopics(["wochenende"], state, deps, null);
  return { ...res, reply: `${res.reply} ${t(state.lang).weekendAsk}`, quick: quick(state.lang, ["nextfree", "book"]) };
}

// ------------------------------------------------- Modell als Hinweis

async function classifyAndRoute(
  text: string,
  masked: string,
  state: ChatState,
  deps: ChatDeps,
  now: Date,
  question = false,
): Promise<ChatResponse> {
  const lang = state.lang;
  const T = t(lang);
  const types = await deps.types();
  // Eine Frage, zu der kein Faktentext passt: Das Modell könnte nur raten.
  // Ehrlich ist „das weiß ich nicht“ – gezählt, damit die Praxis sieht,
  // was gefragt wird (nur der Schlüssel, nie der Text).
  const unknownQuestion = () => {
    deps.audit("chat.unknown_topic", { topic: "frage" });
    return say({ ...state, failures: 0 }, T.unknownTopic, { quick: quick(lang, ["callback", "book"]), links: practiceLink(lang), flags: { llm: "fallback" } });
  };
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
    if (question) return unknownQuestion();
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
  const own = readWhen(text, now, lang);
  const date = cls.date && cls.date === own.date ? cls.date : own.date;
  const time = cls.time && cls.time === own.time ? cls.time : own.time;
  const when: When = { ...own, date, time };
  const next: ChatState = { ...state, failures: 0, lang: cls.lang };
  const flags = { llm: "model" as const };

  switch (cls.intent) {
    case "booking":
      return withLlm(await startBooking(next, deps, now, cls.type ? `${text} ${cls.type}` : text, when), flags);
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
      return withLlm(next.stage === "confirm" ? say(next, T.whatToChange, { quick: changeQuick(lang) }) : notUnderstood(next), flags);
    case "info": {
      const topics = cls.topics.length ? findTopics(cls.topics.join(" "), lang) : [];
      if (topics.length) return withLlm(await answerTopics(topics, next, deps, masked), flags);
      deps.audit("chat.unknown_topic", { topic: "frage" });
      return say(next, T.unknownTopic, { quick: quick(lang, ["callback", "book"]), links: practiceLink(lang), flags });
    }
    default:
      if (question) return withLlm(unknownQuestion(), flags);
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
