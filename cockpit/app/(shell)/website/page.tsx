import { PhasePlaceholder } from "../Placeholder";
export const metadata = { title: "Website" };
export default function Page() {
  return (
    <PhasePlaceholder
      title="Website"
      icon="globe"
      phase={3}
      text="Sprechzeiten, Urlaubsmodus, FAQ, Leistungen und Team werden hier gepflegt und mit einem Klick veröffentlicht."
      bullets={["Urlaubsmodus: ein Schalter für Banner, Buchungspause und Auto-Antwort", "Versionen mit Vorschau, Veröffentlichen per Deploy-Hook", "Team nur mit echten, bestätigten Angaben"]}
    />
  );
}
