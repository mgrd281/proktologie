import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SkipLink } from "@/components/layout/SkipLink";
import { site } from "@/content/site";
import LenisProvider from "@/providers/LenisProvider";
import "./globals.css";

/*
 * Fonts werden zur Buildzeit heruntergeladen und self-hosted ausgeliefert –
 * zur Laufzeit erfolgt kein Request an Google (DSGVO, vgl. LG München I,
 * Urteil v. 20.01.2022, Az. 3 O 17493/20 zu eingebundenen Google Fonts).
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
  // [PLATZHALTER] Domain vor Launch ersetzen (auch in content/site.ts).
  // WICHTIG (HWG/MBO-Ä): Die Bezeichnung „Proktologe" in Title/Description
  // vor Launch mit der tatsächlichen Facharzt-/Zusatzbezeichnung abgleichen.
  metadataBase: new URL(site.url),
  title: {
    default: "Proktologie Eimsbüttel – Dr. Kai Kunstreich, Proktologe Hamburg",
    template: "%s | Proktologie Eimsbüttel",
  },
  description:
    "Ihre proktologische Praxis in Hamburg-Eimsbüttel: diskrete Beratung, moderne Diagnostik und individuelle Behandlung bei Hämorrhoiden, Analfissuren und mehr. Jetzt Termin vereinbaren.",
  keywords: [
    "Proktologie Eimsbüttel",
    "Proktologe Hamburg",
    "Proktologie Hamburg Eimsbüttel",
    "Hämorrhoiden Hamburg",
    "Enddarmpraxis Hamburg",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "Proktologie Eimsbüttel – Dr. Kai Kunstreich",
    title: "Proktologie Eimsbüttel – Dr. Kai Kunstreich",
    description:
      "Moderne Proktologie in Hamburg-Eimsbüttel: diskret, vertrauensvoll und patientenorientiert.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <LenisProvider>
          <SkipLink />
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </LenisProvider>
      </body>
    </html>
  );
}
