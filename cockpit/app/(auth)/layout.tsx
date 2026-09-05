import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";

/**
 * Dunkelgrünes „Set Piece“ wie der Auftakt der Website: Anmeldung,
 * Einladung und Sicherheits-Einrichtung stehen ohne Ablenkung auf der Bühne.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="on-dark flex min-h-dvh flex-col bg-deep text-cream">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <header className="relative flex items-center gap-3 px-6 py-6 md:px-10">
        <LogoMark size={34} className="text-accent" />
        <span className="flex flex-col leading-tight">
          <span className="text-[12px] font-semibold tracking-[0.18em] uppercase">Praxis-Cockpit</span>
          <span className="text-[10px] font-medium tracking-[0.3em] text-cream/70 uppercase">Proktologie Eimsbüttel</span>
        </span>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">{children}</main>
      <footer className="relative px-6 pb-6 text-[11px] tracking-wide text-cream/65 md:px-10">
        Nur für Mitarbeitende der Praxis · Zugang ausschließlich per Einladung
      </footer>
    </div>
  );
}
