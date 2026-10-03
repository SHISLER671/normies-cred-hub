"use client"

import { useState } from "react"

/** A read-only link box with a Copy button. Without JavaScript it is still a box you can select and copy from. */
export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="burn-copy">
      <input className="burn-copy-input" readOnly value={url} aria-label="Link to this answer" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="burn-mini"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setDone(true)
            setTimeout(() => setDone(false), 1800)
          } catch {
            /* clipboard blocked: the box above is still selectable */
          }
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  )
}
