import type { Metadata } from "next";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung der Praxis Proktologie Eimsbüttel – Dr. med. Kai Kunstreich, Hamburg.",
  alternates: { canonical: "/datenschutz/" },
  openGraph: {
    title: "Datenschutzerklärung | Proktologie Eimsbüttel",
    url: "/datenschutz/",
  },
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
        <p className="text-xs font-semibold tracking-[0.2em] text-primary-deep uppercase">
          Rechtliches
        </p>
        <h1 className="font-display mt-4 text-4xl font-medium text-ink">
          Datenschutzerklärung
        </h1>

        <div
          role="note"
          className="mt-8 rounded-xl border-l-4 border-amber-600 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950"
        >
          <strong>Hinweis:</strong> Die Kontaktdaten sind echt; der Text
          selbst ist eine Vorlage und muss vor Veröffentlichung an die
          tatsächlichen Gegebenheiten (insbesondere Hosting und
          Formular-Verarbeitung) angepasst und rechtlich geprüft werden.
        </div>

        <div className="mt-10 space-y-8 leading-relaxed text-ink/80">
          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              1. Verantwortlicher
            </h2>
            <p className="mt-3">
              Verantwortlich für die Datenverarbeitung auf dieser Website ist:
              <br />
              {site.name} – {site.doctor}, {site.address.street},{" "}
              {site.address.zip} {site.address.city}, Telefon {site.phone},
              E-Mail {site.email}.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              2. Grundsätze: sparsame Datenverarbeitung
            </h2>
            <p className="mt-3">
              Diese Website ist bewusst datensparsam gestaltet: Es werden
              keine Cookies zu Analyse- oder Marketingzwecken gesetzt und
              keine Tracking-Dienste eingesetzt. Die verwendeten Schriften
              werden von unserem eigenen Server ausgeliefert; es erfolgt kein
              Abruf bei Google Fonts. Inhalte von Drittservern werden nicht
              automatisch geladen – die einzige Ausnahme ist die Google-Maps-
              Karte, die ausschließlich nach Ihrem ausdrücklichen Klick
              geladen wird (siehe Abschnitt&nbsp;5).
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
              des Formulars ergänzen; bei Einsatz eines Formular-Dienstleisters
              (z.&nbsp;B. Formspree) muss dieser hier als Empfänger inklusive
              Auftragsverarbeitung genannt und Abschnitt&nbsp;2 angepasst
              werden]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              5. Google Maps (Zwei-Klick-Lösung)
            </h2>
            <p className="mt-3">
              Auf der Seite „Praxis &amp; Team&ldquo; bieten wir eine Karte des
              Anbieters Google Ireland Limited (Gordon House, Barrow Street,
              Dublin 4, Irland) an. Die Karte wird{" "}
              <strong>nicht automatisch geladen</strong>: Zunächst sehen Sie
              lediglich eine lokal erzeugte Vorschau. Erst wenn Sie auf
              „Karte laden&ldquo; klicken, wird die Karte von Google abgerufen.
            </p>
            <p className="mt-3">
              Mit diesem Klick willigen Sie in die Übermittlung ein
              (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO). Dabei werden
              insbesondere Ihre IP-Adresse sowie Browser- und Gerätedaten an
              Google übertragen; eine Übermittlung in die USA kann nicht
              ausgeschlossen werden. Ihre Einwilligung gilt nur für den
              jeweiligen Seitenaufruf – laden Sie die Seite neu, ist die
              Karte wieder deaktiviert. Sie können den Standort jederzeit
              auch ohne Kartenladen über den Textlink „Route in Google Maps
              öffnen&ldquo; in einem neuen Tab aufrufen. Weitere Informationen:
              Datenschutzerklärung von Google
              (policies.google.com/privacy).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              6. Speicherdauer
            </h2>
            <p className="mt-3">
              Personenbezogene Daten aus Kontaktanfragen speichern wir nur so
              lange, wie es für die Bearbeitung Ihres Anliegens erforderlich
              ist oder gesetzliche Aufbewahrungspflichten bestehen. [MUSTER —
              konkrete Fristen bzw. Kriterien gemäß Art.&nbsp;13 Abs.&nbsp;2
              lit.&nbsp;a DSGVO ergänzen]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              7. Ihre Rechte
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
              8. Beschwerderecht
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
              9. Stand dieser Erklärung
            </h2>
            <p className="mt-3">[MUSTER — Datum des Inkrafttretens eintragen]</p>
          </section>
        </div>
      </div>
    </div>
  );
}
