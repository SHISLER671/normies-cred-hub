/** A machine-readable 404. Agents and scripts expect JSON, not a 36 KB HTML page. Used by the /api and /.well-known catch-alls. */
export function notFoundJson(req: Request): Response {
  const path = new URL(req.url).pathname
  return new Response(
    JSON.stringify({
      error: "Not found. There is no endpoint at this path.",
      code: "not_found",
      path,
      retryable: false,
      hint: "See /llms.txt for the endpoints this site offers.",
    }),
    { status: 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
  )
}
