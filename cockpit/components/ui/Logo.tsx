import { cn } from "@/lib/cn";

/** Praxis-Monogramm – identische Pfade wie auf der Website. */
export function LogoMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" className={cn("shrink-0", className)}>
      <g fill="currentColor">
        <path d="M6 12c0-3.3 2.7-6 6-6h14c3.3 0 6 2.7 6 6v4c0 3.3-2.7 6-6 6H14v-4h11.4c1.1 0 2-.9 2-2v-3.6c0-1.1-.9-2-2-2H12.6c-1.1 0-2 .9-2 2V42H6V12Z" />
        <path d="M42 36c0 3.3-2.7 6-6 6H22c-3.3 0-6-2.7-6-6v-4c0-3.3 2.7-6 6-6h12v4H22.6c-1.1 0-2 .9-2 2v3.6c0 1.1.9 2 2 2h12.8c1.1 0 2-.9 2-2V6H42v30Z" />
      </g>
    </svg>
  );
}

export function LogoLockup({ onDark = false, compact = false, className }: { onDark?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <LogoMark size={compact ? 30 : 34} className="text-accent" />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className={cn("text-[12px] font-semibold tracking-[0.18em] uppercase", onDark ? "text-cream" : "text-text")}>
            Praxis-Cockpit
          </span>
          <span className={cn("text-[10px] font-medium tracking-[0.3em] uppercase", onDark ? "text-cream/70" : "text-text-muted")}>
            Proktologie Eimsbüttel
          </span>
        </span>
      )}
    </span>
  );
}
