import type { Metadata } from "next";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum der Praxis Proktologie Eimsbüttel – Dr. Kai Kunstreich, Hamburg.",
  alternates: { canonical: "/impressum/" },
  openGraph: {
    title: "Impressum | Proktologie Eimsbüttel",
    url: "/impressum/",
  },
};

/**
 * Impressum nach § 5 DDG (Digitale-Dienste-Gesetz).
 * ALLE Angaben sind MUSTER und müssen vor Veröffentlichung durch die
 * echten Praxisdaten ersetzt und rechtlich geprüft werden.
 */
export default function ImpressumPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 pt-36 pb-24 md:px-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          Rechtliches
        </p>
        <h1 className="font-display mt-4 text-4xl font-medium text-ink">
          Impressum
        </h1>

        <div
          role="note"
          className="mt-8 rounded-xl border-l-4 border-amber-600 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950"
        >
          <strong>Muster-Hinweis:</strong> Alle nachfolgenden Angaben sind
          Platzhalter. Sie müssen vor Veröffentlichung der Website durch die
          tatsächlichen Angaben ersetzt und rechtlich geprüft werden.
        </div>

        <div className="prose-legal mt-10 space-y-8 text-ink/80">
          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              Angaben gemäß § 5 DDG
            </h2>
            <p className="mt-3 leading-relaxed">
              [MUSTER — vor Veröffentlichung ersetzen]
              <br />
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
              Telefon: {site.phone} [MUSTER]
              <br />
              E-Mail: {site.email} [MUSTER]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-medium text-ink">
              Berufsbezeichnung und berufsrechtliche Regelungen
            </h2>
            <p className="mt-3 leading-relaxed">
              Berufsbezeichnung: Arzt (verliehen in der Bundesrepublik
              Deutschland) [MUSTER — Facharztbezeichnung ergänzen]
            </p>
            <p className="mt-3 leading-relaxed">
              Zuständige Ärztekammer: [MUSTER — z. B. Ärztekammer Hamburg,
              Weidestraße 122 b, 22083 Hamburg]
            </p>
            <p className="mt-3 leading-relaxed">
              Zuständige Kassenärztliche Vereinigung: [MUSTER — z. B.
              Kassenärztliche Vereinigung Hamburg]
            </p>
            <p className="mt-3 leading-relaxed">
              Berufsrechtliche Regelungen: Berufsordnung der zuständigen
              Ärztekammer sowie Heilberufsgesetze des Landes [MUSTER — Link zur
              Berufsordnung ergänzen, z. B. über www.aerztekammer-hamburg.org]
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
              [MUSTER — {site.doctor}, Anschrift wie oben]
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
