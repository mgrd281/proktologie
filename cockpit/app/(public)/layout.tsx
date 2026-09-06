import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { PRACTICE } from "@/lib/practice";

/**
 * Patientenseite (Terminverwaltung per Link): dieselbe dunkle Bühne wie die
 * Website und die Anmeldung – ruhig, ohne Cockpit-Navigation, ohne Tracking.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="on-dark flex min-h-dvh flex-col bg-deep text-cream">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <header className="relative flex items-center gap-3 px-6 py-6 md:px-10">
        <LogoMark size={34} className="text-accent" />
        <span className="flex flex-col leading-tight">
          <span className="text-[12px] font-semibold tracking-[0.18em] uppercase">{PRACTICE.name}</span>
          <span className="text-[10px] font-medium tracking-[0.3em] text-cream/70 uppercase">{PRACTICE.doctor}</span>
        </span>
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-4 md:items-center md:pt-0">{children}</main>
      <footer className="relative flex flex-wrap gap-x-6 gap-y-1 px-6 pb-6 text-[11px] tracking-wide text-cream/65 md:px-10">
        <span>{PRACTICE.address}</span>
        <span>Telefon {PRACTICE.phone}</span>
        <a href={PRACTICE.siteUrl} className="underline-offset-2 hover:underline">
          Website der Praxis
        </a>
      </footer>
    </div>
  );
}
