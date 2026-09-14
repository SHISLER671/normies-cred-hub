import type { MetadataRoute } from "next"

import { DEFAULT_SITE_ORIGIN } from "@/lib/site-origin"

const PATHS = ["/", "/ask", "/paths", "/dashboard", "/privacy", "/terms"] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: path === "/" ? DEFAULT_SITE_ORIGIN : `${DEFAULT_SITE_ORIGIN}${path}`,
  }))
}
