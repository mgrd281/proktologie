import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STATUS_LABEL, type AppointmentStatus, type TypeColor } from "@/lib/booking/model";
import { Icon, type IconName } from "./Icon";

/** Kleine, überall wiederkehrende Bausteine. */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-semibold tracking-[0.18em] text-text-muted uppercase", className)}>{children}</p>;
}

export function PageTitle({ eyebrow, title, actions }: { eyebrow?: string; title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-[28px] leading-tight font-medium text-text md:text-[32px]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={cn("rounded-2xl bg-surface-raised ring-1 ring-line", padded && "p-5 md:p-6", className)}>{children}</section>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-surface-sunken px-1.5 font-sans text-[11px] font-medium text-text-muted">
      {children}
    </kbd>
  );
}

const statusTone: Record<AppointmentStatus, string> = {
  booked: "bg-brand-soft text-brand",
  confirmed: "bg-ok/12 text-ok",
  reminded: "bg-info/12 text-info",
  completed: "bg-surface-sunken text-text-muted",
  no_show: "bg-warn/12 text-warn",
  cancelled: "bg-danger/10 text-danger",
};

export function StatusPill({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] uppercase", statusTone[status], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const typeDot: Record<TypeColor, string> = {
  green: "bg-brand-fill",
  moss: "bg-primary",
  amber: "bg-warn",
  slate: "bg-text-faint",
  blue: "bg-info",
};

export function TypeDot({ color, className }: { color: TypeColor; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", typeDot[color], className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  compact,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-10" : "py-20")}>
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} size={26} strokeWidth={1.4} />
      </div>
      <h2 className="font-display text-xl font-medium text-text">{title}</h2>
      {text && <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-200",
            value === o.value ? "bg-text text-surface" : "text-text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: ReactNode }) {
  const tones = {
    info: "border-info bg-info/8 text-text",
    warn: "border-warn bg-warn/8 text-text",
    danger: "border-danger bg-danger/8 text-text",
    ok: "border-ok bg-ok/8 text-text",
  };
  return <div className={cn("rounded-xl border-l-2 px-4 py-3 text-[13px] leading-relaxed", tones[tone])}>{children}</div>;
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-warn uppercase">
      Demo
    </span>
  );
}
