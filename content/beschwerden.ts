/** Beschwerden-Sektion: beruhigende Orientierung für Patientinnen und Patienten. */

export const beschwerdenIntro = {
  kicker: "Beschwerden",
  title: "Was Sie bemerken – und was dahinterstecken kann",
  lead: "Viele Menschen zögern, mit Beschwerden im Analbereich zum Arzt zu gehen. Dabei gilt: Fast alle Ursachen sind gutartig und lassen sich heute schonend behandeln. Je früher Sie kommen, desto einfacher ist meist die Behandlung.",
  note: "Bitte beachten Sie: Blut im Stuhl sollte immer ärztlich abgeklärt werden – auch wenn die Ursache in den meisten Fällen harmlos ist.",
};

export interface BeschwerdeCluster {
  id: string;
  symptom: string;
  text: string;
  advice: string;
}

export const beschwerden: BeschwerdeCluster[] = [
  {
    id: "jucken-brennen",
    symptom: "Juckreiz oder Brennen",
    text: "Anhaltender Juckreiz oder Brennen am After ist häufig und hat oft harmlose Ursachen – etwa Ekzeme, Hämorrhoiden oder eine gereizte Haut.",
    advice:
      "Wenn die Beschwerden länger als einige Tage bestehen oder wiederkehren, lohnt sich eine Abklärung. Meist genügt eine kurze, schonende Untersuchung.",
  },
  {
    id: "blut",
    symptom: "Blut im Stuhl oder am Toilettenpapier",
    text: "Hellrote Blutspuren stammen oft von vergrößerten Hämorrhoiden oder einer kleinen Fissur – beides gut behandelbar.",
    advice:
      "Blut sollte dennoch immer ärztlich abgeklärt werden, um ernstere Ursachen sicher auszuschließen. Vereinbaren Sie dafür zeitnah einen Termin.",
  },
  {
    id: "schmerzen",
    symptom: "Schmerzen beim Stuhlgang oder im Sitzen",
    text: "Schmerzen können auf eine Analfissur, eine Entzündung oder eine Analvenenthrombose hindeuten. Sie sind unangenehm, aber in aller Regel gut therapierbar.",
    advice:
      "Bei starken oder plötzlich auftretenden Schmerzen melden Sie sich gern kurzfristig – bei akuten Beschwerden erhalten Sie zeitnah einen Termin.",
  },
  {
    id: "veraenderungen",
    symptom: "Tastbare Knoten oder Veränderungen",
    text: "Eine tastbare Schwellung oder Hautfalte ist oft eine Mariske, eine vergrößerte Hämorrhoide oder eine kleine Analvenenthrombose – selten etwas Ernstes.",
    advice:
      "Sicherheit gibt eine kurze Untersuchung. Danach wissen Sie, ob überhaupt eine Behandlung nötig ist – vieles darf man auch einfach beobachten.",
  },
];

export const beschwerdenCta = {
  text: "Unsicher, ob Ihre Beschwerden einen Termin rechtfertigen? Im Zweifel: ja. Ein kurzes Gespräch schafft Klarheit.",
  label: "Termin vereinbaren",
  href: "/#kontakt",
};
