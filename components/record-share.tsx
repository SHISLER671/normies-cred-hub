"use client"

import { useEffect, useState } from "react"

import { recordCardImageFilename, recordCardImagePath, recordShareXText } from "@/lib/record-card/share-image"

/**
 * Share buttons for a record card. Read-only: no wallet, no signature, nothing on-chain.
 * Pasting the link anywhere shows the card's preview image (app/record/[tokenId]/opengraph-image.tsx); Download PNG saves
 * that same 1200×630 image. Only the token id goes into links and filenames.
 */
export function RecordShare({
  url,
  tokenId,
  name,
  compact = false,
}: {
  url: string
  tokenId: number
  name: string
  /** One button: the phone share sheet where supported, otherwise Copy link. */
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  // One text for Post on X and the phone share sheet; the link always travels separately as `url`.
  const text = recordShareXText(name, tokenId)
  const xHref = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy this link:", url)
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Record card · Normie #${tokenId}`, text, url })
    } catch {
      // Closed the share sheet; nothing to do.
    }
  }

  if (compact) {
    return canNativeShare ? (
      <button type="button" className="rc-share-btn" onClick={share}>
        Share record
      </button>
    ) : (
      <button type="button" className="rc-share-btn" onClick={copy} aria-live="polite">
        {copied ? "Link copied ✓" : "Copy link"}
      </button>
    )
  }

  return (
    <div className="rc-share" role="group" aria-label="Share this record card">
      {canNativeShare && (
        <button type="button" className="rc-share-btn rc-share-primary" onClick={share}>
          Share
        </button>
      )}
      <a className="rc-share-btn" href={xHref} target="_blank" rel="noopener noreferrer">
        Post on X
      </a>
      <button type="button" className="rc-share-btn" onClick={copy} aria-live="polite">
        {copied ? "Link copied ✓" : "Copy link"}
      </button>
      <a
        className="rc-share-btn"
        href={recordCardImagePath(tokenId)}
        download={recordCardImageFilename(tokenId)}
        type="image/png"
        aria-label={`Download the record card image for Normie #${tokenId} (PNG)`}
      >
        Download PNG
      </a>
    </div>
  )
}
