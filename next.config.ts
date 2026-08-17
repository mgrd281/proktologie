import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Statischer Export: vollständig vorgerendertes HTML, auf jedem Host lauffähig.
  output: "export",
  // /impressum/ -> impressum/index.html – funktioniert ohne Server-Rewrites.
  trailingSlash: true,
  // Im statischen Export gibt es keinen Bildoptimierungs-Server.
  images: { unoptimized: true },
};

export default nextConfig;
