import type { Metadata } from "next"

import { ConnectWallet } from "@/components/connect-wallet"
import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Terms — Normies CredHub",
  description:
    "Normies CredHub is an unofficial community tool. Not Normies Lab, not financial advice. Coming Soon features are not live.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "Terms — Normies CredHub", url: "/terms", siteName: "Normies CredHub", type: "website", images: [{ url: "/og.png", width: 1200, height: 630 }] },
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

        <h2>No warranty</h2>
        <p>
          CredHub is provided as is, without warranties of any kind. Data comes from public sources and outside
          services that can be wrong, late or unavailable, and Zulo&apos;s answers are written by an AI model and
          can be wrong. To the extent the law allows, we are not liable for any loss from using CredHub or acting
          on what it shows.
        </p>

        <h2>Fair use of the APIs</h2>
        <p>
          The public APIs are free and rate-limited. Don&apos;t try to get around the limits, overload the
          service, inflate signals such as Pulse, or use CredHub to look up who owns a wallet.
        </p>

        <h2>Third-party tools</h2>
        <p>
          Tools and agents listed here are third-party unless marked otherwise. A listing is not an endorsement.
        </p>

        <p className="legal-updated mono">Last updated 2026-10-19</p>
      </main>
      <SiteFooter />
    </div>
  )
}
