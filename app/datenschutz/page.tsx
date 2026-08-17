import type { Metadata } from "next";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung der Praxis Proktologie Eimsbüttel – Dr. Kai Kunstreich, Hamburg.",
  alternates: { canonical: "/datenschutz/" },
};

/**
 * Datenschutzerklärung (DSGVO) – MUSTER.
 * Vor Veröffentlichung durch die echten Angaben ersetzen und anwaltlich
 * bzw. durch eine:n Datenschutzbeauftragte:n prüfen lassen.
 */
export default function DatenschutzPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 pt-36 pb-24 md:px-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          Rechtliches
        </p>
        <h1 className="font-display mt-4 text-4xl font-medium text-ink">
          Datenschutzerklärung
        </h1>

        <div
          role="note"
          className="mt-8 rounded-xl border-l-4 border-amber-600 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950"
        >
          <strong>Muster-Hinweis:</strong> Dieser Text ist eine Vorlage. Er
          muss vor Veröffentlichung an die tatsächlichen Gegebenheiten
          (insbesondere Hosting und Formular-Verarbeitung) angepasst und
          rechtlich geprüft werden.
        </div>

        <div className="mt-10 space-y-8 leading-relaxed text-ink/80">
          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              1. Verantwortlicher
            </h2>
            <p className="mt-3">
              Verantwortlich für die Datenverarbeitung auf dieser Website ist:
              <br />
              [MUSTER] {site.name} – {site.doctor}, {site.address.street},{" "}
              {site.address.zip} {site.address.city}, Telefon {site.phone},
              E-Mail {site.email}.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              2. Grundsätze: sparsame Datenverarbeitung
            </h2>
            <p className="mt-3">
              Diese Website ist bewusst datensparsam gestaltet: Es werden keine
              Cookies gesetzt, keine Analyse- oder Tracking-Dienste eingesetzt
              und keine Inhalte von Drittservern (z.&nbsp;B. Karten-Widgets
              oder extern geladene Schriftarten) eingebunden. Die verwendeten
              Schriften werden von unserem eigenen Server ausgeliefert.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              3. Hosting und Server-Logfiles
            </h2>
            <p className="mt-3">
              Beim Aufruf der Website verarbeitet der Hosting-Anbieter
              automatisch technisch notwendige Daten (z.&nbsp;B. IP-Adresse,
              Datum und Uhrzeit des Abrufs, aufgerufene Seite, Browsertyp), um
              die Website sicher auszuliefern (Art.&nbsp;6 Abs.&nbsp;1
              lit.&nbsp;f DSGVO). [MUSTER — Hosting-Anbieter benennen und
              ggf. Auftragsverarbeitungsvertrag erwähnen]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              4. Kontaktaufnahme und Terminanfrage
            </h2>
            <p className="mt-3">
              Wenn Sie uns per Telefon, E-Mail oder über das Kontaktformular
              kontaktieren, verarbeiten wir die von Ihnen mitgeteilten Angaben
              (Name, Kontaktdaten, Inhalt der Anfrage) ausschließlich zur
              Bearbeitung Ihrer Anfrage (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b
              DSGVO). Bitte übermitteln Sie über das Formular keine sensiblen
              Gesundheitsdaten – medizinische Details besprechen wir im
              persönlichen Gespräch. [MUSTER — tatsächlichen Übertragungsweg
              des Formulars ergänzen]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              5. Ihre Rechte
            </h2>
            <p className="mt-3">
              Sie haben das Recht auf Auskunft (Art.&nbsp;15 DSGVO),
              Berichtigung (Art.&nbsp;16), Löschung (Art.&nbsp;17),
              Einschränkung der Verarbeitung (Art.&nbsp;18),
              Datenübertragbarkeit (Art.&nbsp;20) sowie Widerspruch gegen
              Verarbeitungen auf Grundlage berechtigter Interessen
              (Art.&nbsp;21 DSGVO). Wenden Sie sich dazu an die oben genannten
              Kontaktdaten.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              6. Beschwerderecht
            </h2>
            <p className="mt-3">
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde
              zu beschweren, z.&nbsp;B. beim Hamburgischen Beauftragten für
              Datenschutz und Informationsfreiheit. [MUSTER — Anschrift
              ergänzen]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              7. Stand dieser Erklärung
            </h2>
            <p className="mt-3">[MUSTER — Datum des Inkrafttretens eintragen]</p>
          </section>
        </div>
      </div>
    </div>
  );
}
