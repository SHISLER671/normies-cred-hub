import { notFoundJson } from "@/lib/api/not-found"

/**
 * Catch-all for /.well-known paths that do not exist (for example a probe for /.well-known/agent.json). The real files in
 * public/.well-known/ai-tool are static and are served before this route is considered.
 */
export const dynamic = "force-dynamic"

const handler = (req: Request) => notFoundJson(req)
export { handler as GET, handler as HEAD }
