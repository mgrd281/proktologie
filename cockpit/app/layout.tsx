import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

/*
 * Schriften wie auf der Website: zur Buildzeit geladen, self-hosted –
 * zur Laufzeit kein Request an Google (DSGVO).
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Praxis-Cockpit", template: "%s · Praxis-Cockpit" },
  description: "Steuerzentrale der Proktologie Eimsbüttel.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1611" },
  ],
};

/*
 * Theme vor dem ersten Paint setzen (Nutzerwahl aus localStorage – nur eine
 * Anzeigepräferenz, keine personenbezogenen Daten). Ohne Wahl gilt das
 * Systemschema über prefers-color-scheme in tokens.css.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("cockpit-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
