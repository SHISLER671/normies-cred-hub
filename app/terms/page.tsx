import type { Metadata } from "next"

import { ConnectWallet } from "@/components/connect-wallet"
import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Terms — Normies CredHub",
  description:
    "Normies CredHub is an unofficial community tool. Not Normies Lab, not financial advice. Coming Soon features are not live.",
}

export default function TermsPage() {
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
      <main className="legal-page">
        <h1>Terms</h1>
        <p>
          CredHub is an unofficial community tool. It is not Normies Lab and
          it is not financial advice.
        </p>
        <p>
          Features marked Coming Soon are not live. Do not treat planned
          rails, markets, or arenas as available here.
        </p>
        <p>
          This app is read-only: no trades, no approvals, no burns. The
          holder does burns and canvas only in the official Normies UI.
        </p>
        <p>
          Use at your own risk. DYOR before any on-chain action elsewhere.
        </p>

        <p className="legal-updated mono">Last updated 2026-09-14</p>
      </main>
      <SiteFooter />
    </div>
  )
}
