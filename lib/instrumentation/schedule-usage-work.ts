// Server-only: Next `after()` must not enter the client Ask graph.
import { after } from "next/server"

/** Schedule usage work after the response (Next 16 `after`), else void. */
export function scheduleUsageWork(work: () => Promise<unknown>): void {
  const run = () => {
    void work().catch((err) => {
      console.warn("[instrumentation] usage work failed", err)
    })
  }

  try {
    after(run)
  } catch {
    run()
  }
}
