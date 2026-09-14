import type { MetadataRoute } from "next"

import { DEFAULT_SITE_ORIGIN } from "@/lib/site-origin"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/ask", "/paths", "/dashboard", "/privacy", "/terms"],
      disallow: ["/api/"],
    },
    sitemap: `${DEFAULT_SITE_ORIGIN}/sitemap.xml`,
  }
}
