import type { NextConfig } from "next";

/**
 * Das Cockpit ist – anders als die statische Website – eine Server-App:
 * Sessions, Datenbank, Server Actions. Kein `output: "export"`.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Eigenes Projekt im Unterordner: Tracing-Wurzel ist das Cockpit, nicht die Website
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  // Betriebs-/Gesundheitsdaten: keine Vorschaubilder, keine externen Loader
  images: { unoptimized: true },
  // DB-Treiber nicht bündeln: PGlite (WASM) nur lokal, pg nativ auf Vercel
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  /**
   * Die Migrationen sind SQL-Dateien, die erst zur Laufzeit gelesen werden –
   * das Tracing sieht sie deshalb nicht und packt sie nicht ins Bundle. Ohne
   * diese Zeile findet `/api/internal/migrate` auf Vercel keinen einzigen
   * Schritt vor und bricht ab, obwohl der Ordner im Repository liegt.
   */
  outputFileTracingIncludes: {
    "/api/internal/migrate": ["drizzle/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
