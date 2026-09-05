"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Bits";

/**
 * Tabelle für Arbeitslisten: fester Kopf, 40-px-Zeilen (kompakt 36),
 * Tastatur j/k bzw. Pfeile, Enter öffnet, Tabellenziffern in Zahlenspalten.
 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  width?: string;
  numeric?: boolean;
  hideBelow?: "md" | "lg";
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onOpen,
  loading,
  empty,
  dense,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onOpen?: (row: T) => void;
  loading?: boolean;
  empty?: ReactNode;
  dense?: boolean;
  caption: string;
}) {
  const [cursor, setCursor] = useState(-1);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const focusRow = useCallback((i: number) => {
    const tr = bodyRef.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row]")[i];
    tr?.focus();
  }, []);

  useEffect(() => {
    if (cursor >= 0) focusRow(cursor);
  }, [cursor, focusRow]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(rows.length - 1, i + 1));
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(0, i - 1));
    } else if (e.key === "Enter" && onOpen) {
      e.preventDefault();
      onOpen(rows[i]!);
    }
  };

  const rowH = dense ? "h-9" : "h-10";
  const hide = (c: Column<T>) => (c.hideBelow === "md" ? "hidden md:table-cell" : c.hideBelow === "lg" ? "hidden lg:table-cell" : "");

  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-surface-sunken/80 backdrop-blur-sm">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ width: c.width }}
                className={cn(
                  "h-9 px-4 text-left text-[11px] font-semibold tracking-[0.14em] text-text-muted uppercase",
                  c.align === "right" && "text-right",
                  hide(c),
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={bodyRef} className="divide-y divide-line bg-surface-raised">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={`s${i}`} className={rowH}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4", hide(c))}>
                    <Skeleton className="h-3.5 w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-2">
                {empty}
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                data-row
                tabIndex={0}
                onKeyDown={(e) => onKey(e, i)}
                onClick={onOpen ? () => onOpen(row) : undefined}
                className={cn(
                  rowH,
                  "transition-colors duration-150 outline-none focus-visible:bg-brand-soft",
                  onOpen && "cursor-pointer hover:bg-surface-sunken/70",
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 align-middle whitespace-nowrap", c.align === "right" && "text-right", c.numeric && "tnum", hide(c))}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
