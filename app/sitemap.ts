import type { MetadataRoute } from "next";
import { shoenmateGuides } from "../lib/shoenmate-guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://daigomatch.com";
  const routes = [
    "",
    "/guide",
    ...shoenmateGuides.map(({ slug }) => `/guide/${slug}`),
    "/safety",
    "/legal?service=shoenmate",
    "/community-guidelines",
    "/privacy",
    "/terms",
    "/contact",
  ];
  return routes.map((route, index) => ({
    url: `${base}${route}`,
    lastModified: new Date("2026-09-22"),
    changeFrequency: index === 0 ? "daily" : "monthly",
    priority: index === 0 ? 1 : index < 3 ? .85 : .6,
  }));
}
