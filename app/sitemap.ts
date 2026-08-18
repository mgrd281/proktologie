import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${site.url}/impressum/`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site.url}/datenschutz/`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
