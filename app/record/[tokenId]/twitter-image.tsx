// X / Twitter reads its own image route; it shows the same card.
export { default, alt, size, contentType } from "./opengraph-image"

// Route config must be a literal in this file (Next reads it statically), not a re-export.
export const revalidate = 300
