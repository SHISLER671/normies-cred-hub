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

        <h2>Ask Zulo</h2>
        <ul>
          <li>
            Your question, plus public on-chain data about the Normies involved
            (including ones your connected wallet holds), is sent to an AI model
            provider (Venice, with xAI as a backup) to write Zulo&apos;s answer.
          </li>
          <li>
            We may keep Zulo&apos;s answer (not your question, wallet or name)
            and the Normie it was about, so we can check later whether his
            advice held up. These are deleted after 180 days.
          </li>
        </ul>

        <h2>Ratings</h2>
        <ul>
          <li>
            A 👍 or 👎 on a Move is stored with the Move it rated, your
            intent, and your wallet if you connected one (unverified, never
            shown publicly). Only our server can read it.
          </li>
        </ul>

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

        <p className="legal-updated mono">Last updated 2026-10-18</p>
      </main>
      <SiteFooter />
    </div>
  )
}
