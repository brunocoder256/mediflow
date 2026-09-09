import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Marketing site is fully crawlable; the authenticated app (dashboard, POS,
// cash, etc.) and auth flows are excluded so crawl budget focuses on content
// pages and no private data is indexed.
const APP_PATHS = [
  "/api",
  "/auth",
  "/dashboard",
  "/pos",
  "/cash",
  "/products",
  "/inventory",
  "/purchases",
  "/suppliers",
  "/sales",
  "/returns",
  "/expenses",
  "/customers",
  "/reports",
  "/users",
  "/audit",
  "/settings",
  "/transfers",
  "/stock-counts",
  "/sync",
  "/trial-expired",
  "/super-admin",
  "/_next",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features", "/pricing", "/about", "/contact", "/demo", "/privacy", "/terms"],
        disallow: APP_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}