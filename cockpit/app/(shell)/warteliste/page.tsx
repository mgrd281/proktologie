import { PhasePlaceholder } from "../Placeholder";
export const metadata = { title: "Warteliste" };
export default function Page() {
  return (
    <PhasePlaceholder
      title="Warteliste"
      icon="hourglass"
      phase={1}
      text="Wird ein Termin frei, erhält die erste passende Person automatisch ein Angebot – vier Stunden reserviert, danach die nächste."
      bullets={["Wunschzeitfenster je Eintrag", "Angebot per E-Mail mit Ein-Klick-Annahme", "Kein Anruf, keine Zettel"]}
    />
  );
}
