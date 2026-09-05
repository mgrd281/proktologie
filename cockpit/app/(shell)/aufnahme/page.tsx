import { PhasePlaceholder } from "../Placeholder";
export const metadata = { title: "Aufnahme" };
export default function Page() {
  return (
    <PhasePlaceholder
      title="Digitale Aufnahme"
      icon="file-text"
      phase={4}
      text="Der Aufnahmebogen wird vor dem Besuch ausgefüllt, verschlüsselt gespeichert und als PDF für das PVS bereitgestellt – mit automatischer Löschung."
      bullets={["Link automatisch nach der Buchung", "Feldverschlüsselung, Schritt-hoch beim Export", "Löschfrist konfigurierbar (Standard 30 Tage)"]}
    />
  );
}
