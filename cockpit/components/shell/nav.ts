import type { IconName } from "@/components/ui/Icon";

/** Ein Ort für die Navigation – Sidebar, ⌘K und Tastaturkürzel lesen dieselbe Liste. */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Kürzel nach „g“ – Bereiche in Vorbereitung haben keins */
  key?: string;
  /** Noch in Vorbereitung: ehrlich beschriftete Platzhalterseite, eigene Gruppe am Ende */
  preparing?: true;
  /** Zähler in der Seitenleiste (offene Anfragen, wartende Personen) */
  count?: "requests" | "waitlist";
}

export const NAV: NavItem[] = [
  { href: "/", label: "Heute", icon: "home", key: "h" },
  { href: "/termine", label: "Termine", icon: "calendar", key: "t" },
  { href: "/anfragen", label: "Anfragen", icon: "inbox", key: "a", count: "requests" },
  { href: "/warteliste", label: "Warteliste", icon: "hourglass", key: "w", count: "waitlist" },
  { href: "/einstellungen", label: "Einstellungen", icon: "settings", key: "e" },
  { href: "/website", label: "Website", icon: "globe", preparing: true },
  { href: "/aufnahme", label: "Aufnahme", icon: "file-text", preparing: true },
  { href: "/statistik", label: "Statistik", icon: "chart", preparing: true },
];

export const SETTINGS_TABS = [
  { href: "/einstellungen", label: "Terminarten" },
  { href: "/einstellungen/sprechzeiten", label: "Sprechzeiten" },
  { href: "/einstellungen/benutzer", label: "Benutzer" },
  { href: "/einstellungen/sicherheit", label: "Sicherheit" },
  { href: "/einstellungen/demo", label: "Online-Buchung & Betrieb" },
];
