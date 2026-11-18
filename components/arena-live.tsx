"use client"

import { useEffect, useState } from "react"

/**
 * A time in the viewer's own timezone. The server renders it in UTC; the browser then swaps in the local time, so the
 * page never guesses a timezone. The exact UTC time stays in the tooltip.
 */
export function LocalTime({ iso }: { iso: string }) {
  const utc = new Date(iso).toUTCString().replace(" GMT", " UTC")
  const [text, setText] = useState(utc)
  useEffect(() => {
    try {
      setText(new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }))
    } catch {
      setText(utc)
    }
  }, [iso, utc])
  return (
    <time dateTime={iso} title={utc} suppressHydrationWarning>
      {text}
    </time>
  )
}
