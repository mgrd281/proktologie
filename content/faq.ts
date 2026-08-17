/**
 * FAQ – speist das Accordion UND das FAQPage-JSON-LD.
 * Wichtig: Der sichtbare Text und das strukturierte Markup müssen
 * wortidentisch bleiben (beides wird aus dieser Datei generiert).
 */

export const faqIntro = {
  kicker: "Häufige Fragen",
  title: "Was Patientinnen und Patienten uns oft fragen",
};

export interface FaqItem {
  question: string;
  answer: string;
}

export const faq: FaqItem[] = [
  {
    question: "Was passiert beim ersten Termin?",
    answer:
      "Am Anfang steht ein vertrauliches Gespräch über Ihre Beschwerden. Danach folgt – falls sinnvoll und nur mit Ihrem Einverständnis – eine kurze, schonende Untersuchung. Sie erhalten noch im selben Termin eine verständliche Einschätzung und wir besprechen gemeinsam das weitere Vorgehen.",
  },
  {
    question: "Ist die Untersuchung schmerzhaft?",
    answer:
      "Die meisten proktologischen Untersuchungen sind gut verträglich und dauern nur wenige Minuten. Wir gehen behutsam vor, erklären jeden Schritt und passen das Tempo an Sie an. Bei akuten Schmerzen wählen wir ein besonders vorsichtiges Vorgehen.",
  },
  {
    question: "Brauche ich eine Überweisung?",
    answer:
      "In der Regel können Sie auch ohne Überweisung einen Termin vereinbaren. Eine Überweisung Ihrer Hausärztin oder Ihres Hausarztes ist hilfreich, aber keine Voraussetzung. Bei Fragen zu Ihrer Versicherungssituation sprechen Sie uns gern an.",
  },
  {
    question: "Wie bereite ich mich auf die Untersuchung vor?",
    answer:
      "Für die meisten Untersuchungen ist keine besondere Vorbereitung nötig – normale Körperhygiene genügt. Falls für eine Untersuchung doch eine kleine Vorbereitung sinnvoll ist, erklären wir Ihnen das rechtzeitig vor dem Termin.",
  },
  {
    question: "Blut im Stuhl – muss ich mir Sorgen machen?",
    answer:
      "In den meisten Fällen stecken gutartige Ursachen wie Hämorrhoiden oder eine kleine Fissur dahinter. Trotzdem gilt: Blut im Stuhl sollte immer ärztlich abgeklärt werden, um ernstere Ursachen sicher auszuschließen. Vereinbaren Sie dafür bitte zeitnah einen Termin.",
  },
  {
    question: "Übernimmt die Krankenkasse die Kosten?",
    answer:
      "Medizinisch notwendige Untersuchungen und Behandlungen werden in der Regel von den Krankenkassen übernommen. Ob und in welchem Umfang das in Ihrem Fall gilt, hängt von Ihrer Versicherung und der jeweiligen Leistung ab – wir informieren Sie vorab transparent.",
  },
  {
    question: "Wie diskret läuft der Praxisbesuch ab?",
    answer:
      "Diskretion gehört bei uns zum Konzept: vertrauliche Terminvergabe, ruhige Räume, Gespräche hinter verschlossener Tür und ein Team, das sensibel mit Ihrem Anliegen umgeht. Ihre Daten behandeln wir streng vertraulich.",
  },
];
