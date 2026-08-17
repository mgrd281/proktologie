import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "outline-dark" | "ghost";

const base =
  "group inline-flex min-h-11 items-center justify-center gap-3 rounded-full px-7 py-3 text-sm font-medium tracking-wide transition-colors duration-300";

const variants: Record<Variant, string> = {
  /* Weiß auf Primary: ~5,0:1 – AA für Button-Text. */
  primary: "bg-primary text-white hover:bg-[#446628]",
  outline:
    "border border-ink/25 text-ink hover:border-primary hover:text-primary",
  "outline-dark":
    "on-dark border border-white/30 text-cream hover:border-accent hover:text-accent",
  ghost: "text-primary hover:text-[#446628]",
};

interface CommonProps {
  variant?: Variant;
  withArrow?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type ButtonAsLink = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/** CTA-Button; rendert bei `href` einen Link mit identischer Optik. */
export function Button({
  variant = "primary",
  withArrow = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(base, variants[variant], className);
  const arrow = withArrow && (
    <Icon
      name="arrow-right"
      size={18}
      className="transition-transform duration-300 group-hover:translate-x-1"
    />
  );

  if ("href" in rest && typeof rest.href === "string") {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} {...anchorProps}>
        {children}
        {arrow}
      </a>
    );
  }
  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={classes} {...buttonProps}>
      {children}
      {arrow}
    </button>
  );
}
