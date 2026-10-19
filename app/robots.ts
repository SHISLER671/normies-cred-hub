import type { MetadataRoute } from "next"

import { DEFAULT_SITE_ORIGIN } from "@/lib/site-origin"

// Share images that live under /api/ must stay crawlable, or X/Slack/Discord show a link card with no picture.
// Twitterbot honours robots.txt; the longest matching rule wins, so these beat the /api/ disallow.
export const SHARE_IMAGE_PATHS = ["/api/symphony/card"]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/ask", "/paths", "/burn", "/dashboard", "/privacy", "/terms", ...SHARE_IMAGE_PATHS],
      disallow: ["/api/"],
    },
    sitemap: `${DEFAULT_SITE_ORIGIN}/sitemap.xml`,
  }
}
