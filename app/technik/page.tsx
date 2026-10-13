import type { Metadata } from "next";
import { TechnikCheck } from "@/components/technik/TechnikCheck";

export const metadata: Metadata = {
  title: "Technik-Prüfung",
  description: "Was dieser Browser für die Startseite kann – für die Fehlersuche.",
  robots: { index: false, follow: false },
};

/**
 * Eine Seite für die Fehlersuche ohne Entwicklerwerkzeuge: Sie sagt in
 * ganzen Sätzen, was der Browser kann. Ein Bildschirmfoto davon genügt.
 */
export default function TechnikPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 pt-36 pb-24 md:px-8">
        <h1 className="font-display text-3xl font-medium text-ink md:text-4xl">Technik-Prüfung</h1>
        <p className="mt-4 text-lg text-ink/80">
          Diese Seite prüft, was Ihr Browser für die Startseite kann. Bitte machen Sie ein Bildschirmfoto
          und schicken Sie es uns.
        </p>
        <noscript>
          <p className="mt-8 rounded-xl bg-white p-5 text-lg">
            ✗ JavaScript ist in diesem Browser ausgeschaltet. Die Startseite zeigt dann die ruhige Fassung ohne
            Kamerafahrt.
          </p>
        </noscript>
        <TechnikCheck />
      </div>
    </div>
  );
}
