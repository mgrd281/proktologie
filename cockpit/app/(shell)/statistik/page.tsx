import { PhasePlaceholder } from "../Placeholder";
export const metadata = { title: "Statistik" };
export default function Page() {
  return (
    <PhasePlaceholder
      title="Statistik"
      icon="chart"
      phase={5}
      text="Auslastung, Terminarten, Herkunft der Buchungen und die No-Show-Quote – als Wochen-Digest auch per E-Mail an die Praxisleitung."
      bullets={["Tagesblatt um 06:30 zum Ausdrucken", "Wochen-Digest montags 07:00", "Nur Aggregate, keine Einzelpersonen"]}
    />
  );
}
