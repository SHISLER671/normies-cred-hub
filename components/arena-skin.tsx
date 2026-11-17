"use client"

import { useState } from "react"

/**
 * A Normie's Arena skin, loaded straight from the official Arena site by the viewer's browser (no NCH server fetch).
 * The image route is the Arena app's own (not in the official API docs), so if it ever fails the picture simply hides.
 */
export function ArenaSkin({ src, tokenId, profileUrl }: { src: string; tokenId: number; profileUrl?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Arena skin of Normie #${tokenId}`}
      width={96}
      height={96}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ imageRendering: "pixelated", width: 96, height: 96, display: "block" }}
    />
  )
  return (
    <figure style={{ margin: "0 0 16px" }}>
      {profileUrl ? (
        <a href={profileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Normie #${tokenId} in the Arena`}>
          {img}
        </a>
      ) : (
        img
      )}
      <figcaption className="caption">Arena skin (from arena.normies.art)</figcaption>
    </figure>
  )
}
