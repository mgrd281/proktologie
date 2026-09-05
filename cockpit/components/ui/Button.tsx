import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide whitespace-nowrap transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-4 text-[13px]",
  md: "min-h-11 px-6 text-sm",
};
const variants: Record<Variant, string> = {
  primary: "bg-brand-fill font-semibold text-deep hover:bg-[#76a81f]",
  secondary: "border border-line-strong text-text hover:border-brand hover:text-brand",
  ghost: "text-text-muted hover:bg-surface-sunken hover:text-text",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  href?: string;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", icon, iconRight, href, loading, className, children, disabled, type, ...rest }: ButtonProps) {
  const cls = cn(base, sizes[size], variants[variant], className);
  const content = (
    <>
      {loading ? <Icon name="refresh" size={16} className="animate-spin" /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" /> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={cls} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
}

/** Runder Icon-Button (Topbar, Zeilenaktionen). */
export function IconButton({
  label,
  icon,
  size = 36,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconName; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-200 hover:bg-surface-sunken hover:text-text disabled:opacity-40",
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </button>
  );
}
