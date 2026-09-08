/**
 * Fremdsprachen: Türkisch, Arabisch, Russisch, Ukrainisch, Polnisch.
 *
 * Der Assistent spricht Deutsch und Englisch. Schreibt jemand in einer der
 * fünf anderen Sprachen, die in Hamburg am häufigsten vorkommen, dann
 *  1. wird das erkannt (deterministisch, ohne Bibliothek),
 *  2. geht der Text NIE an das Sprachmodell – das entscheidet der Aufrufer
 *     anhand von `detectForeign`, dieses Modul liefert nur das Signal,
 *  3. kommt ein fester, höflicher Satz in dieser Sprache zurück: nur Deutsch
 *     oder Englisch, hier die Telefonnummer der Praxis,
 *  4. wird ein Notfall trotzdem erkannt und in dieser Sprache mit 112 und
 *     116 117 beantwortet.
 *
 * Erkennung: Arabische Schrift → ar. Kyrillisch → uk, wenn ein Buchstabe
 * (і ї є ґ) oder ein Wort vorkommt, das es nur im Ukrainischen gibt, sonst ru.
 * Lateinschrift ist die schwierige Seite, weil Deutsch und Englisch auch
 * lateinisch sind: Türkisch und Polnisch brauchen Belege auf Wortebene –
 * zwei Wörter aus der Liste, oder ein Wort und ein Sonderbuchstabe. Ein
 * deutscher Satz, der einmal „Randevu“ zitiert, bleibt null. Ä, Ö, Ü und ß
 * sind keine Marker. Ein türkischer oder polnischer Nachname in einem sonst
 * deutschen Satz („Frau Yılmaz“) bleibt ebenfalls null.
 *
 * Ehrlich zur Grenze: Persisch und Urdu landen bei „ar“, Belarussisch bei
 * „uk“ oder „ru“, Bulgarisch bei „ru“. Der Text ist dann zwar in der
 * falschen Sprache, aber immer noch die richtige Aussage – nur Deutsch oder
 * Englisch – mit Telefonnummer, und er geht nicht an ein Modell.
 *
 * Reine Funktionen, keine Abhängigkeiten – mit `node --test` prüfbar.
 */
export type ForeignLang = "tr" | "ar" | "ru" | "uk" | "pl";

/**
 * Vergleichsform: arabische Vokalzeichen und Tatweel entfernen, İ → i
 * (JavaScript macht sonst „i + Punkt“ daraus), Kleinschreibung, Leerraum
 * bündeln. Türkisches I wird zu i – die Muster unten erlauben [ıi].
 */
function norm(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function splitWords(t: string): string[] {
  return t.split(/[^\p{L}]+/u).filter(Boolean);
}

/** Ganze Wörter oder Wortfolgen im Text, zum Zählen: „будь ласка“. */
function wordRe(patterns: string[]): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${patterns.join("|")})(?!\\p{L})`, "gu");
}

/** Ein einzelnes Wort, ganz: „bir“ trifft nicht „birth“, „saat\p{L}*“ trifft „saatleriniz“. */
function singleWordRe(patterns: string[]): RegExp {
  return new RegExp(`^(?:${patterns.join("|")})$`, "u");
}

/**
 * Wortanfänge, Beugung egal: „задых“ trifft „задыхаюсь“, „krwaw“ „krwawienie“.
 * Arabisch ohne linke Wortgrenze: و, ب und ال kleben am Wort („بألم“, „والنزيف“).
 */
function stemRe(patterns: string[], leftBoundary: boolean): RegExp {
  return new RegExp(`${leftBoundary ? "(?<!\\p{L})" : ""}(?:${patterns.join("|")})`, "u");
}

function count(t: string, re: RegExp): number {
  return (t.match(re) ?? []).length;
}

const ARABIC_RE = /\p{Script=Arabic}/u;
const CYRILLIC_RE = /\p{Script=Cyrillic}/u;

// ---------------------------------------------------------------------------
// Kyrillisch: Ukrainisch oder Russisch?
// ---------------------------------------------------------------------------

/** Diese vier Buchstaben gibt es im Russischen nicht. */
const UK_CHARS = /[іїєґ]/u;

/** Wörter, die im Russischen anders geschrieben werden (записаться, приём, спасибо, когда …). */
const UK_WORDS = wordRe([
  "записатис[яь]",
  "прийом\\p{L}*",
  "будь ласка",
  "дякую",
  "жити",
  "померти",
  "допомож\\p{L}*",
  "допомог\\p{L}*",
  "дуже",
  "коли",
  "працю\\p{L}*",
  "годин\\p{L}*",
  "відкрит\\p{L}*",
  "лікар\\p{L}*",
  "потрібн\\p{L}*",
  "мені",
  "хотів",
  "хотіла",
  "добрий",
  "тиждень",
  "сьогодні",
  "можна",
  "також",
  "маю",
  "має",
  "чи",
  "що",
  "як",
  "де",
]);

// ---------------------------------------------------------------------------
// Lateinschrift: Türkisch, Polnisch – oder doch Deutsch/Englisch
// ---------------------------------------------------------------------------

/**
 * ğ ş ı İ ç kommen weder im Deutschen noch im Englischen noch im Polnischen
 * vor; ö/ü zählen nicht. Auf dem Rohwort geprüft, weil norm() İ zu i macht.
 */
const TR_CHARS = /[ğşıçİĞŞÇ]/u;
/** ł ą ę ś ź ż ń ć – polnisch. ó fehlt bewusst (Spanisch, Portugiesisch, Namen). */
const PL_CHARS = /[łąęśźżńćŁĄĘŚŹŻŃĆ]/u;

/** Türkische Funktionswörter, jeweils mit und ohne Sonderzeichen (deutsche Tastatur). */
const TR_WORDS = singleWordRe([
  "bir",
  "i[çc]in",
  "randevu\\p{L}*",
  "istiyor\\p{L}*",
  "merhaba",
  "selam",
  "saat\\p{L}*",
  "ka[çc]ta",
  "a[çc][ıi]k\\p{L}*",
  "a[çc][ıi]l[ıi][şs]",
  "[çc]al[ıi][şs]ma",
  "kapal[ıi]",
  "l[üu]tfen",
  "te[şs]ekk[üu]r\\p{L}*",
  "ederim",
  "g[üu]nler",
  "g[üu]nayd[ıi]n",
  "iyi",
  "nas[ıi]l",
  "hangi",
  "zaman",
  "almak",
  "alabilir\\p{L}*",
  "miyim",
  "m[ıi]s[ıi]n[ıi]z",
  "musunuz",
  "m[üu]s[üu]n[üu]z",
  "var",
  "ve",
  "bug[üu]n",
  "yar[ıi]n",
  "hafta",
  "muayene\\p{L}*",
  "etmek",
  "ediyor",
  "oldu",
  "de[ğg]il",
  "evet",
  "hay[ıi]r",
  "ama",
  "ile",
  "sonra",
  "[şs]imdi",
  "hemen",
  "acil",
  "hasta",
  "hastane\\p{L}*",
  "yard[ıi]m",
  "[çc]ok",
  "bu",
  "[şs]u",
  "ben",
  "benim",
  "bana",
  "beni",
  "biz",
  "bize",
  "babam",
  "annem",
  "k[ıi]z[ıi]m",
  "o[ğg]lum",
  "e[şs]im",
  "kocam",
  "kar[ıi]m",
  "san[ıi]r[ıi]m",
  "ge[çc]iriyor",
]);

/** Polnische Alltagswörter. „sie“ und „nie“ fehlen bewusst – beides deutsche Wörter. */
const PL_WORDS = singleWordRe([
  "poniedzia[łl]ek",
  "wtorek",
  "[śs]rod[aęe]",
  "czwartek",
  "pi[ąa]tek",
  "sobot[aęe]",
  "niedziel[aęe]",
  "kt[óo]r(?:ej|ym|a|y|e|ego)",
  "otwiera(?:cie|j[ąa]|my|sz)",
  "zamkni[ęe]t\\p{L}*",
  "rano",
  "popo[łl]udniu",
  "wieczorem",
  "tydzie[ńn]",
  "tygodni\\p{L}*",
  "chc[ęe]",
  "chcia[łl]a?bym",
  "chcieliby[śs]my",
  "um[óo]wi[ćc]",
  "się",
  "wizyt[ęeay]",
  "(?:po)?prosz[ęe]",
  "dzi[ęe]kuj[ęe]",
  "godzin(?:y|ach|a)?",
  "otwart[eya]",
  "czynn[eyai]",
  "dzie[ńn]",
  "dobry",
  "dobrze",
  "witam",
  "kiedy",
  "czy",
  "jest",
  "są",
  "jaki(?:e|ch)?",
  "lekarz\\p{L}*",
  "przychodni[ae]?",
  "gabinet\\p{L}*",
  "jutro",
  "dzisiaj",
  "dzi[śs]",
  "tydzie[ńn]",
  "tygodniu",
  "poniedzia[łl]ek",
  "wtorek",
  "[śs]rod[ęa]",
  "czwartek",
  "pi[ąa]tek",
  "rano",
  "po[łl]udniu",
  "mog[ęe]",
  "mo[żz]na",
  "mo[żz]e",
  "zapisa[ćc]",
  "wolne",
  "pani",
  "pa[ńn]stwo",
  "bardzo",
  "m[óo]j",
  "moja",
  "moje",
  "mnie",
  "mam",
  "ma",
  "jestem",
  "tak",
  "ju[żz]",
  "jeszcze",
  "te[żz]",
  "tylko",
  "teraz",
  "pomoc\\p{L}*",
  "potrzebuj[ęe]",
  "szpital\\p{L}*",
  "boli",
  "b[óo]l",
  "ojciec",
  "matka",
  "m[ąa][żz]",
  "[żz]ona",
  "syn",
  "c[óo]rka",
  "dziecko",
  "chor[yae]",
]);

/**
 * Häufigste deutsche und englische Funktionswörter. Sie entscheiden nur den
 * Grenzfall „Sonderbuchstaben, aber kein Listenwort“: Steht auch nur eines
 * davon im Satz, ist „Frau Yılmaz“ ein deutscher Satz mit türkischem Namen.
 */
const DE_EN_GUARD = new Set([
  "ich","bin","und","der","die","das","ein","eine","einen","einem","nicht","bitte","danke","termin",
  "hätte","haette","gern","gerne","möchte","moechte","wann","sie","ihnen","für","fuer","mit","habe","ist",
  "hallo","guten","morgen","tag","frau","herr","dr",
  "the","and","is","are","not","please","thanks","thank","appointment","would","like","want","when",
  "you","hello","open","for","with","have","my","need","can","could","mr","mrs","ms",
]);

interface Evidence {
  /** Wörter aus der Liste */
  hits: number;
  /** Wörter, die nur durch einen Sonderbuchstaben auffallen – Namen zum Beispiel */
  charOnly: number;
}

function evidence(raw: string[], chars: RegExp, word: RegExp): Evidence {
  let hits = 0;
  let charOnly = 0;
  for (const w of raw) {
    if (word.test(norm(w))) hits++;
    else if (chars.test(w)) charOnly++;
  }
  return { hits, charOnly };
}

/**
 * Zwei verschiedene Wörter müssen auffallen: zwei Listenwörter, oder ein
 * Listenwort und ein Wort mit Sonderbuchstaben. Nur Sonderbuchstaben (zwei
 * Wörter) reichen, wenn kein deutsches/englisches Funktionswort dabei ist –
 * „Kızım çok hasta“ hat kein Listenwort, „Frau Yılmaz“ ist Deutsch.
 * Ein einziges Wort – „Randevu“ zitiert, „Dziękuję“ allein – reicht nie.
 */
function enough(e: Evidence, deEn: number): boolean {
  return e.hits + e.charOnly >= 2 && (e.hits >= 1 || deEn === 0);
}

/** Sprache erkennen – nur wenn der Text eindeutig NICHT Deutsch/Englisch ist; sonst null. */
export function detectForeign(text: string): ForeignLang | null {
  if (ARABIC_RE.test(text)) return "ar";
  if (CYRILLIC_RE.test(text)) {
    const t = norm(text);
    return UK_CHARS.test(t) || count(t, UK_WORDS) >= 1 ? "uk" : "ru";
  }

  // Rohwörter (Großschreibung bleibt – İ ist ein Marker), Vergleichsform je Wort
  const raw = splitWords(text);
  if (raw.length === 0) return null;
  const deEn = raw.filter((w) => DE_EN_GUARD.has(norm(w))).length;

  const tr = evidence(raw, TR_CHARS, TR_WORDS);
  const pl = evidence(raw, PL_CHARS, PL_WORDS);
  const trOk = enough(tr, deEn);
  const plOk = enough(pl, deEn);
  if (trOk && plOk) return tr.hits + tr.charOnly >= pl.hits + pl.charOnly ? "tr" : "pl";
  if (trOk) return "tr";
  if (plOk) return "pl";
  return null;
}

// ---------------------------------------------------------------------------
// Notfall – bewusst großzügig, wie in safety.ts: lieber ein Fehlalarm.
// Alle Muster auf der Vergleichsform (Kleinschreibung, [ıi] für türkisches I).
// ---------------------------------------------------------------------------

const EMERGENCY_TR = stemRe([
  "kalp kriz",
  "kalbim (?:s[ıi]k[ıi][şs]|a[ğg]r[ıi])",
  "g[öo][ğg][üu]s a[ğg]r[ıi]",
  "g[öo][ğg]s[üu]m(?:de)?[^.!?]{0,15}(?:a[ğg]r|s[ıi]k[ıi][şs]|bask)",
  "nefes alam",
  "nefes darl",
  "nefesim (?:kesil|daral)",
  "bo[ğg]ul(?:uyor|acak)",
  "bilinc[iı] kapal[ıi]",
  "bilinci?ni kaybet",
  "bilin[çc]siz",
  "bay[ıi]ld",
  "bay[ıi]l[ıi]yor",
  "kanama durm",
  "kan durmuyor",
  "[çc]ok kan[ıi]yor",
  "[şs]iddetli kanama",
  "a[ğg][ıi]r kanama",
  "fel[çc]",
  "inme",
  "[iı]ntihar",
  "[öo]lmek [iı]stiyorum",
  "kendimi [öo]ld[üu]r",
  "ya[şs]amak [iı]stemiyorum",
  "can[ıi]ma k[ıi]y",
  "[öo]l[üu]yor",
  "a[şs][ıi]r[ıi] doz",
  "acil durum",
  "acil yard[ıi]m",
  "ambulans",
], true);

const EMERGENCY_AR = stemRe([
  "نوب[ةه] قلبي[ةه]",
  "[أا]زم[ةه] قلبي[ةه]",
  "ذبح[ةه] صدري[ةه]",
  "[أا]لم (?:في |ب)?الصدر",
  "وجع (?:في |ب)?الصدر",
  "لا [أا]ستطيع (?:[أا]ن )?[أا]تنفس",
  "لا [أا]ستطيع التنفس",
  "(?:لا|ما) [أا]قدر [أا]تنفس",
  "ضيق (?:في )?(?:ال)?تنفس",
  "ضيق (?:في )?(?:ال)?نفس",
  "[أا]ختناق",
  "فاقد[ةه]? (?:ال)?وعي",
  "فقد(?:ت)? (?:ال)?وعي",
  "[أا]غمي علي",
  "غائب[ةه]? عن الوعي",
  "نزيف (?:شديد|حاد|قوي|غزير)",
  "(?:ال)?نزيف لا يتوقف",
  "لا يتوقف النزيف",
  "(?:ي|ت)نزف بشد[ةه]",
  "سكت[ةه] دماغي[ةه]",
  "جلط[ةه]",
  "شلل",
  "[أا]نتحار",
  "[أا]نتحر",
  "[أا]ريد [أا]ن [أا]موت",
  "[أا]ريد الموت",
  "[أا]قتل نفسي",
  "لا [أا]ريد [أا]ن [أا]عيش",
  "(?:ي|أ|ا)حتضر",
  "جرع[ةه] زائد[ةه]",
  "حال[ةه] طارئ[ةه]",
  "طوارئ",
  "[إأا]سعاف",
], false);

const EMERGENCY_RU = stemRe([
  "сердечн\\p{L}* приступ",
  "инфаркт",
  "бол(?:ь|и|ит) в груди",
  "давит в груди",
  "грудь болит",
  "не могу дышать",
  "нечем дышать",
  "трудно дышать",
  "тяжело дышать",
  "задых",
  "без сознания",
  "потерял\\p{L}* сознание",
  "теряет сознание",
  "обморок",
  "сильн\\p{L}* кровотеч",
  "кровотечение не остан",
  "кровь не остан",
  "истека\\p{L}* кровью",
  "инсульт",
  "суицид",
  "самоубийств",
  "хочу умереть",
  "покончить с собой",
  "убить себя",
  "не хочу жить",
  "умира",
  "передозировк",
  "скор(?:ая|ую) помощ",
], true);

const EMERGENCY_UK = stemRe([
  "серцев\\p{L}* напад",
  "інфаркт",
  "біль (?:у|в) грудях",
  "болить (?:у|в) грудях",
  "давить (?:у|в) грудях",
  "не можу дихати",
  "важко дихати",
  "нічим дихати",
  "задиха",
  "без свідомості",
  "знепритомні",
  "непритомн",
  "втрати\\p{L}* свідомість",
  "втрача\\p{L}* свідомість",
  "сильн\\p{L}* кровотеч",
  "кровотеча не зупиня",
  "кров не зупиня",
  "інсульт",
  "самогубств",
  "хочу померти",
  "покінчити з собою",
  "вбити себе",
  "не хочу жити",
  "помира",
  "передозуванн",
  "швидк\\p{L}* допомог",
], true);

const EMERGENCY_PL = stemRe([
  "zawa[łl]",
  "b[óo]l w klatce",
  "boli w klatce",
  "b[óo]l w piersiach",
  "ucisk w klatce",
  "nie mog[ęe] oddycha[ćc]",
  "trudno mi oddycha[ćc]",
  "nie mog[ęe] z[łl]apa[ćc] (?:tchu|oddechu)",
  "duszn",
  "nieprzytomn",
  "zemdla",
  "straci[łl]\\p{L}* przytomno[śs][ćc]",
  "traci przytomno[śs][ćc]",
  "utrata przytomno[śs]ci",
  "siln\\p{L}* krwaw",
  "mocno krwaw",
  "bardzo krwaw",
  "krwaw\\p{L}* nie (?:ustaje|przestaje)",
  "nie mog[ęe] zatamowa[ćc]",
  "krwotok",
  "udar",
  "samob[óo]jstw",
  "chc[ęe] umrze[ćc]",
  "nie chc[ęe] [żz]y[ćc]",
  "zabi[ćc] si[ęe]",
  "odebra[ćc] sobie [żz]ycie",
  "umiera",
  "przedawkowa",
  "nag[łl]y wypadek",
  "karetk",
  "pogotowi",
], true);

/**
 * Russisch und Ukrainisch sind auf kurzen Texten nicht sicher zu trennen
 * („Я не хочу жити“ hat keinen ukrainischen Buchstaben). Wer als „ru“
 * einsortiert wurde, bekommt den Notfall trotzdem erkannt – die Antwort ist
 * dann russisch, das versteht fast jede ukrainische Patientin. Umgekehrt genauso.
 */
const EMERGENCY_CYRILLIC = new RegExp(`${EMERGENCY_RU.source}|${EMERGENCY_UK.source}`, "u");

const EMERGENCY: Record<ForeignLang, RegExp> = {
  tr: EMERGENCY_TR,
  ar: EMERGENCY_AR,
  ru: EMERGENCY_CYRILLIC,
  uk: EMERGENCY_CYRILLIC,
  pl: EMERGENCY_PL,
};

/** Lebensbedrohliche Lage in dieser Sprache? Konservativ: lieber ein Fehlalarm. */
export function detectForeignEmergency(text: string, lang: ForeignLang): boolean {
  return EMERGENCY[lang].test(norm(text));
}

// ---------------------------------------------------------------------------
// Feste Texte – nichts davon stammt aus einem Modell.
// ---------------------------------------------------------------------------

export interface ForeignTexts {
  /** Nur Deutsch oder Englisch, Telefonnummer der Praxis. Höchstens zwei Sätze. */
  reply: string;
  /** 112, dann 116 117. Höchstens drei Sätze. */
  emergency: string;
  /** Beschriftung „Termin buchen“ – der Klick führt dann auf Deutsch weiter. */
  quickBook: string;
  /** Beschriftung „Öffnungszeiten“ */
  quickHours: string;
  /** Eigenname der Sprache */
  langName: string;
}

/**
 * Im Arabischen laufen Ziffernblöcke sonst von rechts nach links durcheinander
 * („21 80 490 040“). U+2066 … U+2069 (Left-to-Right Isolate) hält die Nummer
 * als Ganzes zusammen und ist unsichtbar.
 */
const LTR = (s: string) => `\u2066${s}\u2069`;

export const FOREIGN_TEXTS: Record<ForeignLang, ForeignTexts> = {
  tr: {
    reply:
      "Maalesef yalnızca Almanca veya İngilizce olarak yardımcı olabiliyorum. Muayenehaneye 040 490 80 21 numaralı telefondan ulaşabilirsiniz.",
    emergency:
      "Bu bir acil durum gibi görünüyor. Lütfen hemen 112'yi arayın. Acil olan ancak hayati tehlike taşımayan durumlarda 116 117 numaralı nöbetçi hekim hizmetini arayabilirsiniz.",
    quickBook: "Randevu al",
    quickHours: "Çalışma saatleri",
    langName: "Türkçe",
  },
  ar: {
    reply:
      `للأسف، لا يمكنني المساعدة إلا باللغة الألمانية أو الإنجليزية. يمكنكم التواصل مع العيادة هاتفياً على الرقم ${LTR("040 490 80 21")}.`,
    emergency:
      `يبدو أن هذه حالة طارئة. يرجى الاتصال فوراً بالرقم 112. في الحالات العاجلة غير المهددة للحياة، يرجى الاتصال بخدمة الطبيب المناوب على الرقم ${LTR("116 117")}.`,
    quickBook: "حجز موعد",
    quickHours: "ساعات العمل",
    langName: "العربية",
  },
  ru: {
    reply:
      "К сожалению, я могу помочь только на немецком или английском языке. Вы можете позвонить в практику по телефону 040 490 80 21.",
    emergency:
      "Похоже, это экстренный случай. Пожалуйста, немедленно позвоните по номеру 112. При срочных, но не угрожающих жизни проблемах звоните в дежурную врачебную службу по номеру 116 117.",
    quickBook: "Записаться на приём",
    quickHours: "Часы приёма",
    langName: "Русский",
  },
  uk: {
    reply:
      "На жаль, я можу допомогти лише німецькою або англійською мовою. Ви можете зателефонувати до практики за номером 040 490 80 21.",
    emergency:
      "Схоже, це невідкладний випадок. Будь ласка, негайно зателефонуйте за номером 112. У термінових, але не небезпечних для життя випадках телефонуйте до чергової лікарської служби за номером 116 117.",
    quickBook: "Записатися на прийом",
    quickHours: "Години прийому",
    langName: "Українська",
  },
  pl: {
    reply:
      "Niestety mogę pomóc wyłącznie w języku niemieckim lub angielskim. Z praktyką lekarską można skontaktować się telefonicznie pod numerem 040 490 80 21.",
    emergency:
      "To wygląda na nagły przypadek. Proszę natychmiast zadzwonić pod numer 112. W pilnych, ale niezagrażających życiu sprawach proszę dzwonić do lekarskiej służby dyżurnej pod numer 116 117.",
    quickBook: "Umów wizytę",
    quickHours: "Godziny otwarcia",
    langName: "Polski",
  },
};
