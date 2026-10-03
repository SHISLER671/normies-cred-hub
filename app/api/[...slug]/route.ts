import { notFoundJson } from "@/lib/api/not-found"

/**
 * Catch-all for paths under /api that do not exist. Real routes always win over this one (Next matches the most specific
 * route first), so it only ever answers for missing paths.
 */
export const dynamic = "force-dynamic"

const handler = (req: Request) => notFoundJson(req)
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as HEAD }
