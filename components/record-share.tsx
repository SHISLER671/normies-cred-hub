"use client"

import { useEffect, useState } from "react"

/**
 * Share buttons for a record card. Read-only: no wallet, no signature, nothing on-chain.
 * Pasting the link anywhere shows the card's preview image (app/record/[tokenId]/opengraph-image.tsx).
 */
export function RecordShare({ url, tokenId, name }: { url: string; tokenId: number; name: string }) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  const text = `${name}'s record card on NCH: verified identity and trust gate. A track record, not a tip.`
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
    </div>
  )
}
