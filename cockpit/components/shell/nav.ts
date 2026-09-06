import type { IconName } from "@/components/ui/Icon";

/** Ein Ort für die Navigation – Sidebar, ⌘K und Tastaturkürzel lesen dieselbe Liste. */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Kürzel nach „g“ */
  key: string;
  /** Kommt in einer späteren Phase – Seite ist ein gestalteter Platzhalter. */
  phase?: number;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Heute", icon: "home", key: "h" },
  { href: "/termine", label: "Termine", icon: "calendar", key: "t" },
  { href: "/anfragen", label: "Anfragen", icon: "inbox", key: "a", phase: 2 },
  { href: "/warteliste", label: "Warteliste", icon: "hourglass", key: "w" },
  { href: "/website", label: "Website", icon: "globe", key: "s", phase: 3 },
  { href: "/aufnahme", label: "Aufnahme", icon: "file-text", key: "u", phase: 4 },
  { href: "/statistik", label: "Statistik", icon: "chart", key: "k", phase: 5 },
  { href: "/einstellungen", label: "Einstellungen", icon: "settings", key: "e" },
];

export const SETTINGS_TABS = [
  { href: "/einstellungen", label: "Terminarten" },
  { href: "/einstellungen/sprechzeiten", label: "Sprechzeiten" },
  { href: "/einstellungen/benutzer", label: "Benutzer" },
  { href: "/einstellungen/sicherheit", label: "Sicherheit" },
  { href: "/einstellungen/demo", label: "Demo & Betrieb" },
];
