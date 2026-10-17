import Link from "next/link";

export const metadata = { title: "Nicht gefunden" };

/** Unbekannte Adresse im Cockpit – deutsch, mit dem Weg zurück. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-6 text-center">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-text-muted uppercase">Praxis-Cockpit</p>
        <h1 className="font-display mt-3 text-[28px] font-medium text-text">Diese Seite gibt es nicht (mehr).</h1>
        <p className="mt-2 text-[14px] text-text-muted">Vielleicht ein alter Link oder ein Tippfehler in der Adresse.</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-fill px-6 text-sm font-semibold text-deep hover:bg-[#76a81f]">
          Zu „Heute“
        </Link>
      </div>
    </main>
  );
}
