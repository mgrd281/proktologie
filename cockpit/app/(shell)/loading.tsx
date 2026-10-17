import { Skeleton } from "@/components/ui/Bits";

/**
 * Während eine Seite des Cockpits lädt: Titel und Inhalt als ruhige
 * Platzhalter in der Form, die gleich kommt – kein leerer Bildschirm.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Wird geladen …">
      <div className="mb-6">
        <Skeleton className="mb-2 h-3 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
      </div>
      <Skeleton className="mb-6 h-14 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3 rounded-2xl bg-surface-raised p-5 ring-1 ring-line">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
