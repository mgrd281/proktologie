import type { Metadata } from "next";
import { site } from "@/content/site";
import { arzt } from "@/content/arzt";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum der Praxis Proktologie Eimsbüttel – Dr. med. Kai Kunstreich, Hamburg.",
  alternates: { canonical: "/impressum/" },
  openGraph: {
    title: "Impressum | Proktologie Eimsbüttel",
    url: "/impressum/",
  },
};

/**
 * Impressum nach § 5 DDG (Digitale-Dienste-Gesetz).
 * Stammdaten von der Bestandsseite übernommen; verbleibende Lücken sind
 * als [MUSTER] markiert. Vor Veröffentlichung rechtlich prüfen lassen.
 */
export default function ImpressumPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 pt-36 pb-24 md:px-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary-deep uppercase">
          Rechtliches
        </p>
        <h1 className="font-display mt-4 text-4xl font-medium text-ink">
          Impressum
        </h1>

        <div
          role="note"
          className="mt-8 rounded-xl border-l-4 border-amber-600 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950"
        >
          <strong>Hinweis:</strong> Bitte vor Veröffentlichung rechtlich
          prüfen lassen; mit [MUSTER] markierte Angaben müssen noch ergänzt
          werden.
        </div>

        <div className="mt-10 space-y-8 text-ink/80">
          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              Angaben gemäß § 5 DDG
            </h2>
            <p className="mt-3 leading-relaxed">
              {site.name}
              <br />
              {site.doctor}
              <br />
              {site.address.street}
              <br />
              {site.address.zip} {site.address.city}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">Kontakt</h2>
            <p className="mt-3 leading-relaxed">
              Telefon: {site.phone}
              <br />
              Fax: {site.fax}
              <br />
              E-Mail: {site.email}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              Berufsbezeichnung und berufsrechtliche Regelungen
            </h2>
            <p className="mt-3 leading-relaxed">
              Gesetzliche Berufsbezeichnung: Arzt (verliehen in der
              Bundesrepublik Deutschland)
              <br />
              {arzt.role}
            </p>
            <p className="mt-3 leading-relaxed">
              Zuständige Ärztekammer: Ärztekammer Hamburg, Weidestraße 122 B,
              22083 Hamburg, Telefon 040 202299-0,
              www.aerztekammer-hamburg.de
            </p>
            <p className="mt-3 leading-relaxed">
              Zuständige Kassenärztliche Vereinigung: Kassenärztliche
              Vereinigung Hamburg, Heidenkampsweg 99, 22097 Hamburg,
              www.kvhh.de
            </p>
            <p className="mt-3 leading-relaxed">
              Berufsrechtliche Regelungen: Berufsordnung der Ärztekammer
              Hamburg sowie Hamburgisches Kammergesetz für die Heilberufe
              (abrufbar über www.aerztekammer-hamburg.de)
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              Aufsichtsbehörde
            </h2>
            <p className="mt-3 leading-relaxed">
              [MUSTER — zuständige Aufsichtsbehörde eintragen]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              Umsatzsteuer-ID
            </h2>
            <p className="mt-3 leading-relaxed">
              [MUSTER — falls vorhanden, Umsatzsteuer-Identifikationsnummer
              gemäß § 27a UStG eintragen; ärztliche Heilbehandlungen sind in
              der Regel umsatzsteuerfrei]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              Verantwortlich für den Inhalt
            </h2>
            <p className="mt-3 leading-relaxed">
              {site.doctor}, Anschrift wie oben
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
