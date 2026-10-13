"use client";

import { site } from "@/content/site";

/**
 * Letzte Auffangstelle, wenn sogar das Grundgerüst scheitert: keine
 * weiße Seite, sondern Name, Telefon und Adresse der Praxis.
 */
export default function GlobalError() {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f1ea", color: "#1d2a2e" }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 20px" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 16px" }}>{site.name}</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6 }}>
            Die Seite konnte in Ihrem Browser nicht vollständig geladen werden. Sie erreichen uns telefonisch unter{" "}
            <a href={site.phoneHref}>{site.phone}</a>.
          </p>
          <p style={{ fontSize: 18 }}>
            {/* Bewusst ein voller Neuladevorgang, kein Client-Routing – das Gerüst ist ja gescheitert. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Seite neu laden</a>
          </p>
        </main>
      </body>
    </html>
  );
}
