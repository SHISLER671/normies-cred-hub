import type { Metadata } from "next"

import { ConnectWallet } from "@/components/connect-wallet"
import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Privacy — Normies CredHub",
  description:
    "How Normies CredHub uses an optional wallet connect, gas-free signMessage proof, and public data sources. No keys, no custody, no token approvals.",
}

export default function PrivacyPage() {
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
        <h1>Privacy</h1>
        <p>
          CredHub is a read-only community tool. This page is the whole
          privacy note — short on purpose.
        </p>

        <h2>Wallet</h2>
        <ul>
          <li>
            Wallet connect is optional and used to scope Normies the visitor
            controls.
          </li>
          <li>
            Only a gas-free <span className="mono">signMessage</span> for
            proof. No token approvals. No custody.
          </li>
          <li>We do not ask for keys or seeds.</li>
        </ul>

        <h2>Data</h2>
        <p>
          Data sources: Normies API, Ethos, ERC-8004, on-chain reads.
        </p>

        <h2>Contact</h2>
        <p>
          shisler671.eth /{" "}
          <a
            href="https://x.com/zulo7141"
            target="_blank"
            rel="noopener noreferrer"
          >
            @zulo7141
          </a>
        </p>

        <p className="legal-updated mono">Last updated 2026-09-14</p>
      </main>
      <SiteFooter />
    </div>
  )
}
