import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Verlaufslinie ohne Achsen – Trend auf einen Blick, Details im Tooltip. */
export function Sparkline({ values, className, height = 28, width = 96 }: { values: number[]; className?: string; height?: number; width?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - (v / max) * (height - 4) - 2] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" className={cn("overflow-visible", className)}>
      <polygon points={area} fill="currentColor" opacity="0.1" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.2" fill="currentColor" />
    </svg>
  );
}

export function KpiTile({
  label,
  value,
  unit,
  sub,
  spark,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  spark?: number[];
  tone?: "neutral" | "ok" | "warn" | "danger";
  className?: string;
}) {
  const toneCls = { neutral: "text-brand", ok: "text-ok", warn: "text-warn", danger: "text-danger" }[tone];
  return (
    <div className={cn("flex flex-col justify-between rounded-2xl bg-surface-raised p-5 ring-1 ring-line", className)}>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-text-muted uppercase">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-display tnum text-[36px] leading-none font-medium text-text">
          {value}
          {unit && <span className="ml-1 text-[14px] font-sans font-medium text-text-muted">{unit}</span>}
        </p>
        {spark && <Sparkline values={spark} className={toneCls} />}
      </div>
      {sub && <p className="mt-3 text-[12px] text-text-muted">{sub}</p>}
    </div>
  );
}
