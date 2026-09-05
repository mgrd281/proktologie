import { PhasePlaceholder } from "../Placeholder";
export const metadata = { title: "Anfragen" };
export default function Page() {
  return (
    <PhasePlaceholder
      title="Anfragen"
      icon="inbox"
      phase={2}
      text="Rückrufe, Folgerezepte, Überweisungen und Befundkopien laufen von der Website direkt in einen Posteingang mit Zuständigkeit und Fristen."
      bullets={[
        "Ein-Klick-Antworten aus Vorlagen („Rezept liegt bereit“)",
        "Zeitziel je Anfrageart, überfällige Anfragen oben",
        "Zuweisung an Mitarbeitende, Verlauf im Audit-Log",
      ]}
    />
  );
}
