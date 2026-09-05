import { Card, EmptyState, PageTitle } from "@/components/ui/Bits";
import type { IconName } from "@/components/ui/Icon";

/**
 * Gestaltete Platzhalter für Bereiche späterer Phasen – ehrlich beschriftet:
 * Was kommt, wann, und was es ersetzt. Keine Attrappen mit Scheindaten.
 */
export function PhasePlaceholder({ title, icon, phase, text, bullets }: { title: string; icon: IconName; phase: number; text: string; bullets: string[] }) {
  return (
    <>
      <PageTitle eyebrow={`Phase ${phase}`} title={title} />
      <Card>
        <EmptyState icon={icon} title={`${title} kommt in Phase ${phase}`} text={text} compact />
        <ul className="mx-auto mt-2 max-w-md space-y-2 pb-6 text-[13px] text-text-muted">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-fill" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
