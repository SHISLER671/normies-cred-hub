/**
 * Canonical public origin for this deployment.
 *
 * Default is the current Vercel origin. Do not invent or buy a domain here.
 *
 * Env: NEXT_PUBLIC_SITE_URL
 *   Example: https://normiescredhub.vercel.app
 *   No trailing slash. There is no .env.example in this repo; set it in
 *   `.env.local` and in the Vercel project env.
 *
 * When a custom domain is attached in Vercel, set NEXT_PUBLIC_SITE_URL and
 * then plan a coordinated manifest re-hash + ERC-8257 registry update.
 * Do not rewrite registered manifest `endpoint` / image URLs until that pass
 * (hash risk).
 */
export const DEFAULT_SITE_ORIGIN = "https://normiescredhub.vercel.app"

export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || DEFAULT_SITE_ORIGIN
}
