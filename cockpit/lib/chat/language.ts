/**
 * Sprache der Nachricht bestimmen – nicht die des Browsers.
 *
 * Der Auftrag ist eindeutig: Englisch, sobald die Patientin Englisch
 * schreibt. Eine Browsereinstellung sagt darüber wenig; ein Mensch mit
 * deutschem System kann auf Englisch schreiben und umgekehrt.
 *
 * Verfahren: häufige Funktionswörter zählen. Sie sind kurz, kommen in fast
 * jedem Satz vor und unterscheiden die beiden Sprachen zuverlässiger als
 * Fachbegriffe. Umlaute und ß geben einen Zuschlag für Deutsch.
 *
 * Bei zu wenig Anhaltspunkten („14:30“, „ok“, „Erika“) bleibt es bei der
 * bisherigen Sprache – ein Chat soll nicht mitten im Satz umspringen.
 */
export type Lang = "de" | "en";

const DE = [
  "ich","ist","nicht","und","einen","eine","einem","der","die","das","den","dem","für","fuer","mit","auf","haben","habe","hat",
  "bitte","danke","möchte","moechte","gern","gerne","wann","wie","wo","was","warum","kann","können","koennen","muss","soll",
  "termin","termine","uhr","morgen","heute","übermorgen","uebermorgen","woche","montag","dienstag","mittwoch","donnerstag","freitag",
  "frei","offen","geöffnet","geoeffnet","sprechzeiten","öffnungszeiten","oeffnungszeiten","anfahrt","adresse","praxis","danke",
  "nummer","faxnummer","kommen","geht","wäre","waere","gut","nachmittags","vormittags","absagen","verschieben","nehmen","lieber","jemand","ihr","euch","seid","habt","wir","uns",
  "sie","ihnen","ihre","mein","meine","noch","auch","sehr","würde","wuerde","hätte","haette","brauche","suche",
];

const EN = [
  "i","the","is","are","not","and","a","an","for","with","on","have","has","do","does","did",
  "please","thanks","thank","would","like","want","when","how","where","what","why","can","could","should","need",
  "appointment","appointments","time","tomorrow","today","week","monday","tuesday","wednesday","thursday","friday",
  "free","available","open","opening","hours","directions","address","practice","you","your","my","me","also","very","there","book","booking",
  "number","fax","doctor","see","come","anything","something","afternoon","morning","check","cancel","change","date","rather","sure","ahead","someone","call","back","closed","if","possible","later","earlier","none","these","other","day",
];

const DE_SET = new Set(DE);
const EN_SET = new Set(EN);

export interface LangGuess {
  lang: Lang;
  /** „low“ = zu wenig Anhaltspunkte, die bisherige Sprache bleibt bestehen. */
  confidence: "high" | "low";
}

export function detectLanguage(text: string, fallback: Lang = "de"): LangGuess {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  if (words.length === 0) return { lang: fallback, confidence: "low" };

  let de = 0;
  let en = 0;
  for (const w of words) {
    if (DE_SET.has(w)) de++;
    if (EN_SET.has(w)) en++;
  }
  // Umlaute und ß gibt es im Englischen nicht
  if (/[äöüß]/i.test(text)) de += 2;

  if (de === 0 && en === 0) return { lang: fallback, confidence: "low" };
  if (de === en) return { lang: fallback, confidence: "low" };
  const lang: Lang = de > en ? "de" : "en";
  // Ein einzelnes Treffwort in einem langen Satz ist noch kein Beweis
  const diff = Math.abs(de - en);
  return { lang, confidence: diff >= 2 || words.length <= 4 ? "high" : "low" };
}
