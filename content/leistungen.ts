/** Leistungsspektrum der Praxis – speist die Leistungen-Sektion und das JSON-LD. */

import type { IconName } from "@/components/ui/Icon";

export interface Leistung {
  slug: string;
  title: string;
  teaser: string;
  icon: IconName;
}

export const leistungenIntro = {
  kicker: "Leistungen",
  title: "Unser proktologisches Leistungsspektrum",
  text: "Von der ersten Abklärung bis zur ambulanten Behandlung: Wir begleiten Sie mit moderner Medizin, Erfahrung und der nötigen Ruhe – immer abgestimmt auf Ihre persönliche Situation.",
};

export const leistungen: Leistung[] = [
  {
    slug: "haemorrhoiden",
    title: "Hämorrhoiden",
    teaser:
      "Vergrößerte Hämorrhoiden behandeln wir stadiengerecht: je nach Befund mit Verödung oder Gummibandligatur – in der Regel ohne Betäubung möglich – bis hin zum ambulanten Eingriff.",
    icon: "leaf",
  },
  {
    slug: "analfissur",
    title: "Analfissur",
    teaser:
      "Ein kleiner Einriss der Analhaut kann sehr unangenehm sein. Mit sorgfältiger Diagnose und konsequenter Therapie heilen viele Fissuren ohne Operation ab.",
    icon: "shield",
  },
  {
    slug: "analfistel",
    title: "Analfistel",
    teaser:
      "Fistelgänge erfordern Erfahrung und ein durchdachtes Vorgehen. Wir klären den Verlauf präzise ab und besprechen mit Ihnen die geeignete Behandlung.",
    icon: "route",
  },
  {
    slug: "marisken",
    title: "Marisken",
    teaser:
      "Harmlose Hautfalten am After können im Alltag stören. Wir beraten Sie diskret, ob und wie eine Entfernung sinnvoll ist.",
    icon: "feather",
  },
  {
    slug: "analabszess",
    title: "Analabszess",
    teaser:
      "Eine akute Entzündung braucht zeitnahe Hilfe. Wir sorgen für rasche Entlastung und eine sorgfältige Nachbehandlung, um Folgebeschwerden vorzubeugen.",
    icon: "pulse",
  },
  {
    slug: "diagnostik",
    title: "Proktologische Diagnostik",
    teaser:
      "Proktoskopie und Rektoskopie mit modernen LED-Instrumenten: präzise, behutsam und ohne besondere Darmvorbereitung – verständlich erklärt, Schritt für Schritt.",
    icon: "scope",
  },
  {
    slug: "ambulante-behandlungen",
    title: "Ambulante Behandlungen",
    teaser:
      "Viele Eingriffe führen wir in örtlicher Betäubung direkt in unserem eigenen, modernen Praxis-OP durch. Sie sind noch am selben Tag wieder zu Hause – mit klarem Nachsorgeplan.",
    icon: "home",
  },
  {
    slug: "krebsvorsorge",
    title: "Enddarm-Krebsvorsorge",
    teaser:
      "Im Rahmen der Krebsvorsorge untersuchen wir After und Mastdarm. Für die komplette Darmspiegelung kooperieren wir mit erfahrenen Praxen und Kliniken und helfen Ihnen, den richtigen Untersucher zu finden.",
    icon: "shield",
  },
];
