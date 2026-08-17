/** „Warum diese Praxis" – fünf Gründe, editorial als nummerierte Zeilen gesetzt. */

export const benefitsIntro = {
  kicker: "Warum diese Praxis",
  title: "Gute Gründe für Ihren Besuch",
};

export interface Benefit {
  title: string;
  text: string;
}

export const benefits: Benefit[] = [
  {
    title: "Diskrete Betreuung",
    text: "Kurze Wartezeiten, ruhige Räume und ein Team, das Vertraulichkeit ernst nimmt – vom ersten Anruf an.",
  },
  {
    title: "Moderne Diagnostik",
    text: "Zeitgemäße Untersuchungsverfahren, schonend eingesetzt und verständlich erklärt.",
  },
  {
    title: "Individuelle Behandlung",
    text: "Keine Therapie von der Stange: Wir richten uns nach Befund, Lebenssituation und Ihren Wünschen.",
  },
  {
    title: "Kurze Wege",
    text: "Beratung, Diagnostik und viele ambulante Behandlungen an einem Ort – mitten in Eimsbüttel, gut erreichbar.",
  },
  {
    title: "Vertrauensvolle Atmosphäre",
    text: "Zeit für Ihre Fragen und eine Ansprache auf Augenhöhe. Sie sollen sich gut aufgehoben fühlen.",
  },
];
