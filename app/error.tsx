"use client"

import Link from "next/link"
import { useEffect } from "react"

import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

import "./zulo/styles.css"

/**
 * Shown when a page throws unexpectedly (an outside service failed in a way the page didn't handle). Plain words, a
 * retry, and no error details on screen: the digest is only for matching server logs.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error.digest ?? "", error)
  }, [error])

  return (
    <div className="zulo-chrome">
      <ZuloChromeHeader />
      <div className="header-spacer" aria-hidden />
      <main className="not-found-main">
        <h1 className="hero-title-hub">Something didn&apos;t load</h1>
        <p className="hero-subtitle">
          A data source CredHub reads from didn&apos;t answer. Nothing was changed, and nothing on-chain was touched.
        </p>
        <nav className="hero-actions" aria-label="What next">
          <button type="button" className="button" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="button">
            Home
          </Link>
        </nav>
        {error.digest ? <p className="caption mono">Ref {error.digest}</p> : null}
      </main>
      <SiteFooter />
    </div>
  )
}
