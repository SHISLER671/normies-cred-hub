// Weak pathId helpfulness for ranking. Cold-start = 0.5. Fail open.

import { getRecommendationFeedbackRows } from "@/lib/db/supabase"

const FEEDBACK_WINDOW_DAYS = 90

export function helpfulScoreFromCounts(ups: number, downs: number): number {
  const u = Math.max(0, ups)
  const d = Math.max(0, downs)
  const total = u + d
  if (total === 0) return 0.5
  // Laplace: unknown paths stay near 0.5; a few votes cannot dominate.
  return (u + 1) / (total + 2)
}

export async function getPathFeedbackScores(
  pathIds: string[],
): Promise<Map<string, number>> {
  const scores = new Map<string, number>()
  const unique = [...new Set(pathIds.filter((id) => id.trim().length > 0))]
  for (const id of unique) scores.set(id, 0.5)
  if (unique.length === 0) return scores

  try {
    const rows = await getRecommendationFeedbackRows(unique, FEEDBACK_WINDOW_DAYS)
    const ups = new Map<string, number>()
    const downs = new Map<string, number>()
    for (const row of rows) {
      if (row.rating === "up") ups.set(row.path_id, (ups.get(row.path_id) ?? 0) + 1)
      else if (row.rating === "down") {
        downs.set(row.path_id, (downs.get(row.path_id) ?? 0) + 1)
      }
    }
    for (const id of unique) {
      scores.set(
        id,
        helpfulScoreFromCounts(ups.get(id) ?? 0, downs.get(id) ?? 0),
      )
    }
  } catch (err) {
    console.warn("[path-ranker] feedback scores skipped:", err)
  }
  return scores
}
