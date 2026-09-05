import type { ReactElement, SVGProps } from "react";

/**
 * Inline-SVG-Icons – dieselbe Zeichensprache wie auf der Website
 * (24er-Viewbox, Strich 1.6, runde Enden), erweitert um das Vokabular
 * eines Arbeitswerkzeugs. Dekorativ per Default (aria-hidden).
 */
export type IconName =
  | "arrow-right"
  | "arrow-left"
  | "arrow-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "check"
  | "close"
  | "plus"
  | "minus"
  | "menu"
  | "search"
  | "command"
  | "home"
  | "calendar"
  | "inbox"
  | "hourglass"
  | "globe"
  | "file-text"
  | "chart"
  | "settings"
  | "users"
  | "user"
  | "key"
  | "lock"
  | "shield"
  | "logout"
  | "sun"
  | "moon"
  | "bell"
  | "filter"
  | "printer"
  | "download"
  | "external"
  | "refresh"
  | "trash"
  | "edit"
  | "more"
  | "clock"
  | "phone"
  | "mail"
  | "pin"
  | "alert"
  | "info"
  | "dot"
  | "sparkle"
  | "list"
  | "grid"
  | "eye"
  | "eye-off"
  | "copy";

const paths: Record<IconName, ReactElement> = {
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  "arrow-left": <path d="M20 12H4m6-6-6 6 6 6" />,
  "arrow-down": <path d="M12 4v16m-6-6 6 6 6-6" />,
  "chevron-left": <path d="M15 5l-7 7 7 7" />,
  "chevron-right": <path d="M9 5l7 7-7 7" />,
  "chevron-down": <path d="M5 9l7 7 7-7" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm10 3-5-5" />,
  command: (
    <path d="M9 9V6a3 3 0 1 0-3 3h3Zm0 0v6m0-6h6m-6 6v3a3 3 0 1 1-3-3h3Zm6-6h3a3 3 0 1 0-3-3v3Zm0 0v6m0 0h3a3 3 0 1 1-3 3v-3Zm0 0H9" />
  ),
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z" />,
  calendar: <path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3-3v4m8-4v4M4 11h16" />,
  inbox: <path d="M4 13V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7m-16 0h5l1.5 3h5L16 13h4m-16 0v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />,
  hourglass: <path d="M7 3h10M7 21h10M8 3c0 5 4 5 4 9s-4 4-4 9m8-18c0 5-4 5-4 9s4 4 4 9" />,
  globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c-3 3.5-3 14.5 0 18m0-18c3 3.5 3 14.5 0 18M3 12h18M5 7.5h14M5 16.5h14" />,
  "file-text": <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-4-5Zm0 0v5h4M9 12h6m-6 4h6" />,
  chart: <path d="M4 20V4m0 16h16M8 16v-5m4 5V8m4 8v-3" />,
  settings: (
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.1l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.9-1.1L14.7 3h-4l-.4 2.4a7.5 7.5 0 0 0-1.9 1.1L6.1 5.6l-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.2l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 1.9 1.1l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 1.9-1.1l2.3.9 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z" />
  ),
  users: <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19m11-12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm5 12v-1.5a3.5 3.5 0 0 0-2.5-3.4M16 4.2a3 3 0 0 1 0 5.6" />,
  user: <path d="M19 20v-1.5a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V20m10-12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
  key: <path d="M15 3a6 6 0 0 0-5.7 7.9L3 17.2V21h3.8l1.2-1.2v-2.2h2.2L12 15.8V14l1.1-1.1A6 6 0 1 0 15 3Zm1.5 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />,
  lock: <path d="M6 10h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm2 0V7a4 4 0 1 1 8 0v3m-4 5v2" />,
  shield: <path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3Zm-3 9l2.2 2.2L15.5 10" />,
  logout: <path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4m5-4 4-4-4-4m4 4H9" />,
  sun: <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4M7 17l-1.4 1.4" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4" />,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />,
  printer: <path d="M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7v-6Z" />,
  download: <path d="M12 4v11m-5-4 5 5 5-5M5 20h14" />,
  external: <path d="M14 4h6v6m0-6-9 9M10 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4" />,
  refresh: <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M4 4v5h5m11 11v-5h-5" />,
  trash: <path d="M5 7h14M9 7V4h6v3m-7 0v13h8V7M10 11v6m4-6v6" />,
  edit: <path d="M4 20h4l11-11-4-4L4 16v4Zm10-14 4 4" />,
  more: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3} />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.5 2" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C9.7 20.5 3.5 14.3 3 6a2 2 0 0 1 2-2Z" />,
  mail: <path d="M4 6h16v12H4V6Zm0 1l8 6 8-6" />,
  pin: <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  alert: <path d="M12 3l9.5 17h-19L12 3Zm0 6v5m0 3h.01" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5m0-8h.01" />,
  dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  grid: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  "eye-off": <path d="M3 3l18 18M10.6 6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5s-1 1.9-2.9 3.6M6.6 6.7C4 8.5 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  copy: <path d="M9 9h10v11H9V9Zm-4 6H4V4h11v1" />,
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
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
