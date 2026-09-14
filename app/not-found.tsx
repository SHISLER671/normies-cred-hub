import Link from "next/link"

import { ConnectWallet } from "@/components/connect-wallet"
import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

import "./zulo/styles.css"

export default function NotFound() {
  return (
    <div className="zulo-chrome">
      <ZuloChromeHeader
        trailing={
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <ConnectWallet />
          </span>
        }
      />
      <div className="header-spacer" aria-hidden />
      <main className="not-found-main">
        <h1 className="hero-title-hub">Page not found</h1>
        <p className="hero-subtitle">This route is not on CredHub.</p>
        <nav className="hero-actions" aria-label="CredHub pages">
          <Link href="/" className="button">
            Home
          </Link>
          <Link href="/ask" className="button">
            Ask
          </Link>
          <Link href="/paths" className="button">
            Moves
          </Link>
          <Link href="/dashboard" className="button">
            Pulse
          </Link>
        </nav>
      </main>
      <SiteFooter />
    </div>
  )
}
