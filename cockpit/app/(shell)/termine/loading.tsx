import { Skeleton } from "@/components/ui/Bits";

/** Kalender lädt: Kopf, Schalter und das Raster als Platzhalter. */
export default function Loading() {
  return (
    <div role="status" aria-label="Kalender wird geladen …">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="h-8 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
        <Skeleton className="ml-auto h-9 w-48 rounded-full" />
      </div>
      <Skeleton className="h-[420px] w-full rounded-2xl" />
    </div>
  );
}
