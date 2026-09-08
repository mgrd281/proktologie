/**
 * Fremdsprachen: erkennen, Notfall erkennen, feste Texte.
 * Ausführen:  node --test lib/chat/foreign.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { detectForeign, detectForeignEmergency, FOREIGN_TEXTS } = await import("./foreign.ts");

const LANGS = ["tr", "ar", "ru", "uk", "pl"];

/** Je Sprache: Terminwunsch und Frage nach den Öffnungszeiten – kein Notfall. */
const HARMLESS = {
  tr: ["Merhaba, bir randevu almak istiyorum.", "Çalışma saatleriniz nedir?", "Saat kaçta açıksınız?"],
  ar: ["أريد حجز موعد من فضلكم", "ما هي ساعات العمل؟", "هل يمكنني الحصول على موعد يوم الثلاثاء؟"],
  ru: ["Здравствуйте, я хочу записаться на приём.", "Когда вы работаете?", "Скажите, пожалуйста, часы работы"],
  uk: ["Доброго дня, хочу записатися на прийом.", "Коли ви працюєте?", "Хочу записатися на прийом, будь ласка"],
  pl: ["Dzień dobry, chciałbym umówić wizytę.", "W jakich godzinach jest otwarte?", "Czy są wolne terminy w przyszłym tygodniu?"],
};

const EMERGENCIES = {
  tr: [
    "Babam kalp krizi geçiriyor sanırım",
    "Nefes alamıyorum, göğsüm ağrıyor",
    "Annem bayıldı ve kanama durmuyor",
    "İNTİHAR ETMEK İSTİYORUM",
  ],
  ar: [
    "أشعر بألم في الصدر ولا أستطيع التنفس",
    "زوجي فاقد الوعي",
    "عندي نزيف شديد والنزيف لا يتوقف",
    "أريد أن أموت",
  ],
  ru: [
    "У мужа сильная боль в груди, он задыхается",
    "Мама без сознания, кровь не останавливается",
    "Кажется, у него инсульт",
    "Я хочу умереть",
  ],
  uk: [
    "У мене біль у грудях і не можу дихати",
    "Батько знепритомнів, сильна кровотеча",
    "Здається, у неї інсульт",
    "Я не хочу жити",
  ],
  pl: [
    "Mój mąż ma zawał, nie mogę go dobudzić",
    "Nie mogę oddychać i mam silny ból w klatce piersiowej",
    "Ojciec zemdlał i krwawienie nie ustaje",
    "Chcę umrzeć",
  ],
};

for (const lang of LANGS) {
  test(`${lang}: Terminwunsch und Öffnungszeiten werden als ${FOREIGN_TEXTS[lang].langName} erkannt`, () => {
    for (const s of HARMLESS[lang]) {
      assert.equal(detectForeign(s), lang, `falsch: ${s}`);
    }
  });

  test(`${lang}: Notfall wird erkannt`, () => {
    for (const s of EMERGENCIES[lang]) {
      assert.equal(detectForeign(s), lang, `Sprache falsch: ${s}`);
      assert.equal(detectForeignEmergency(s, lang), true, `Notfall übersehen: ${s}`);
    }
  });

  test(`${lang}: Terminwunsch ist kein Notfall`, () => {
    for (const s of HARMLESS[lang]) {
      assert.equal(detectForeignEmergency(s, lang), false, `Fehlalarm: ${s}`);
    }
  });
}

test("Deutsch bleibt null – auch mit Umlauten und ß", () => {
  const saetze = [
    "Ich hätte gern einen Termin für Dienstag",
    "Wann haben Sie geöffnet?",
    "Guten Morgen, ich hätte gern einen Termin",
    "Können Sie mir bitte die Öffnungszeiten sagen? Große Straße, außerdem.",
    "Ich möchte meinen Termin verschieben, danke schön",
  ];
  for (const s of saetze) assert.equal(detectForeign(s), null, `falsch: ${s}`);
});

test("Englisch bleibt null", () => {
  const saetze = [
    "Hello, when are you open?",
    "I would like to book an appointment for Tuesday",
    "Could you tell me your opening hours please?",
  ];
  for (const s of saetze) assert.equal(detectForeign(s), null, `falsch: ${s}`);
});

test("Zu wenig Text bleibt null", () => {
  for (const s of ["ok", "14:30", "", "   ", "👍", "Erika"]) {
    assert.equal(detectForeign(s), null, `falsch: „${s}“`);
  }
});

test("Ein zitiertes Fremdwort macht aus Deutsch kein Türkisch", () => {
  assert.equal(detectForeign("Meine Nachbarin sagt immer Randevu statt Termin"), null);
  assert.equal(detectForeign("Ich habe das Wort Randevu gelesen"), null);
  assert.equal(detectForeign("Dziękuję heißt danke auf Polnisch"), null);
});

test("Türkischer oder polnischer Nachname in deutschem Satz bleibt null", () => {
  assert.equal(detectForeign("Guten Tag, ich bin Frau Yılmaz und hätte gern einen Termin"), null);
  assert.equal(detectForeign("Ich bin Herr Doğan, wann haben Sie geöffnet?"), null);
  assert.equal(detectForeign("Ich bin Frau Wiśniewska und brauche einen Termin"), null);
  assert.equal(detectForeign("Hello, this is Mr Çelik, when are you open?"), null);
});

test("Türkisch ohne Sonderzeichen (deutsche Tastatur) wird trotzdem erkannt", () => {
  assert.equal(detectForeign("Merhaba, randevu almak istiyorum, tesekkurler"), "tr");
  assert.equal(detectForeign("Dzien dobry, chcialbym umowic wizyte"), "pl");
});

test("Russisch und Ukrainisch werden auseinandergehalten", () => {
  assert.equal(detectForeign("Спасибо, до свидания"), "ru");
  assert.equal(detectForeign("Дякую, до побачення"), "uk");
  assert.equal(detectForeign("Є вільні місця на завтра?"), "uk");
});

test("Notfall in falscher Sprache abgefragt löst nicht aus", () => {
  assert.equal(detectForeignEmergency("Nefes alamıyorum", "pl"), false);
  assert.equal(detectForeignEmergency("Chcę umrzeć", "tr"), false);
});

test("FOREIGN_TEXTS: alle fünf Sprachen, nichts leer, Nummern an der richtigen Stelle", () => {
  assert.deepEqual(Object.keys(FOREIGN_TEXTS).sort(), [...LANGS].sort());
  const names = { tr: "Türkçe", ar: "العربية", ru: "Русский", uk: "Українська", pl: "Polski" };
  for (const lang of LANGS) {
    const t = FOREIGN_TEXTS[lang];
    for (const k of ["reply", "emergency", "quickBook", "quickHours", "langName"]) {
      assert.ok(typeof t[k] === "string" && t[k].trim().length > 0, `${lang}.${k} leer`);
    }
    assert.equal(t.langName, names[lang]);
    assert.ok(t.reply.includes("040 490 80 21"), `${lang}: Telefonnummer fehlt in reply`);
    assert.ok(!t.reply.includes("112"), `${lang}: reply darf keine 112 enthalten`);
    assert.ok(t.emergency.includes("112"), `${lang}: 112 fehlt in emergency`);
    assert.ok(t.emergency.includes("116 117"), `${lang}: 116 117 fehlt in emergency`);
    assert.ok(t.emergency.indexOf("112") < t.emergency.indexOf("116 117"), `${lang}: 112 muss vor 116 117 stehen`);
    // Höchstens zwei bzw. drei Sätze
    const sentences = (s) => s.split(/[.!?؟]+\s/).filter(Boolean).length;
    assert.ok(sentences(t.reply) <= 2, `${lang}: reply hat zu viele Sätze`);
    assert.ok(sentences(t.emergency) <= 3, `${lang}: emergency hat zu viele Sätze`);
  }
});
