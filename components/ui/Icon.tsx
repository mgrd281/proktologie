import type { ReactElement, SVGProps } from "react";

/**
 * Schlankes Inline-SVG-Icon-Set (statt einer Icon-Bibliothek).
 * Alle Icons: 24er-Viewbox, Stroke in currentColor, dekorativ per Default
 * (aria-hidden) – beschriftende Texte stehen immer daneben.
 */

export type IconName =
  | "leaf"
  | "shield"
  | "route"
  | "feather"
  | "pulse"
  | "scope"
  | "home"
  | "arrow-right"
  | "arrow-down"
  | "pin"
  | "clock"
  | "phone"
  | "mail"
  | "menu"
  | "close"
  | "plus"
  | "mouse"
  | "check";

const paths: Record<IconName, ReactPath> = {
  leaf: (
    <path d="M6 18C4 12 8 5 20 4c0 12-7 16-13 14Zm0 0c1.5-4.5 4.5-8 9-10" />
  ),
  shield: (
    <path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3Zm-3 9l2.2 2.2L15.5 10" />
  ),
  route: (
    <path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
  ),
  feather: (
    <path d="M20 4c-6 0-11 4-12 10l-3 6m5-4h6c3-2 4-5 4-8V4ZM8 16l8-8" />
  ),
  pulse: <path d="M3 12h4l2.5-6 4 12L16 12h5" />,
  scope: (
    <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm5 12l4 4M11 8v3l2 2" />
  ),
  home: (
    <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z" />
  ),
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  "arrow-down": <path d="M12 4v16m-6-6 6 6 6-6" />,
  pin: (
    <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
  ),
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.5 2" />,
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C9.7 20.5 3.5 14.3 3 6a2 2 0 0 1 2-2Z" />
  ),
  mail: <path d="M4 6h16v12H4V6Zm0 1l8 6 8-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  mouse: (
    <path d="M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6Zm0 4v4" />
  ),
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
};

type ReactPath = ReactElement;

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
