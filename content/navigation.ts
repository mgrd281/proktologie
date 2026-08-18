/** Hauptnavigation – Anchor-Ziele auf der Startseite. */

export interface NavItem {
  label: string;
  href: string;
}

export const navigation: NavItem[] = [
  { label: "Leistungen", href: "/#leistungen" },
  { label: "Beschwerden", href: "/#beschwerden" },
  { label: "Diagnostik", href: "/#diagnostik" },
  { label: "Über den Arzt", href: "/#ueber-den-arzt" },
  { label: "Team", href: "/#team" },
  { label: "Praxis", href: "/#praxis" },
  { label: "FAQ", href: "/#faq" },
  { label: "Kontakt", href: "/#kontakt" },
];

export const ctaLabel = "Termin vereinbaren";
export const ctaHref = "/#kontakt";

export const legalNavigation: NavItem[] = [
  { label: "Impressum", href: "/impressum/" },
  { label: "Datenschutz", href: "/datenschutz/" },
];
