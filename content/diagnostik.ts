/** Diagnostik-Sektion: Ablauf der Untersuchung, vertrauensbildend erklärt. */

export const diagnostikIntro = {
  kicker: "Diagnostik",
  title: "Moderne Diagnostik – behutsam und gründlich",
  lead: "Die meisten Untersuchungen dauern nur wenige Minuten und sind deutlich weniger unangenehm, als viele befürchten. Wir erklären Ihnen jeden Schritt vorab – nichts geschieht ohne Ihr Einverständnis.",
};

export interface DiagnostikSchritt {
  step: string;
  title: string;
  text: string;
}

export const diagnostikSchritte: DiagnostikSchritt[] = [
  {
    step: "01",
    title: "Vertrauliches Gespräch",
    text: "Am Anfang steht immer das Gespräch: Ihre Beschwerden, Ihre Vorgeschichte, Ihre Fragen. In Ruhe und hinter verschlossener Tür.",
  },
  {
    step: "02",
    title: "Schonende Untersuchung",
    text: "Je nach Fragestellung folgt eine behutsame Untersuchung, bei Bedarf eine Proktoskopie oder Rektoskopie. Beides ist in der Regel gut verträglich und schnell vorbei.",
  },
  {
    step: "03",
    title: "Klarer Befund",
    text: "Sie erfahren noch im selben Termin, was wir festgestellt haben und welche Möglichkeiten es gibt. Verständlich erklärt, ohne Fachchinesisch.",
  },
];
