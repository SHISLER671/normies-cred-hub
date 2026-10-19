import type { Metadata } from "next"

import { ConnectWallet } from "@/components/connect-wallet"
import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Privacy — Normies CredHub",
  description:
    "What Normies CredHub keeps, for how long, and who else sees it. Optional wallet connect, no keys, no custody, no token approvals.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Privacy — Normies CredHub", url: "/privacy", siteName: "Normies CredHub", type: "website", images: [{ url: "/og.png", width: 1200, height: 630 }] },
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
          <li>Connecting a wallet is optional. It is used to find the Normies that wallet controls.</li>
          <li>
            The only signature we ever ask for is a gas-free <span className="mono">signMessage</span>. No
            transactions, no token approvals, no custody. We never ask for keys or seed phrases.
          </li>
          <li>We never look up a wallet from a username or link wallets to people.</li>
        </ul>

        <h2>What we keep, and for how long</h2>
        <ul>
          <li>
            <strong>Usage counters</strong> (Upstash Redis): when Pulse or Moves is called we keep the token id, the
            time, a short intent text for Moves (up to 200 characters), the caller&apos;s wallet if one was sent,
            and a one-way hash of the IP address (never the IP itself). Day counters expire after 16 days; the
            event list keeps the latest 10,000 entries. Wallets are never shown in reports.
          </li>
          <li>
            <strong>Rate limits and security log</strong> (Upstash Redis): IP addresses are used briefly to rate
            limit requests. When a limit is hit, or a security report is sent, the IP, any wallet sent and any
            contact you give are kept in a tamper-evident security log.
          </li>
          <li>
            <strong>Ratings</strong> (Supabase): a 👍 or 👎 on a Move is stored with the Move, your intent, and your
            wallet if you connected one (unverified, never shown publicly). Only our server can read it.
          </li>
          <li>
            <strong>Zulo&apos;s answers</strong> (Supabase): we may keep an answer (not your question, wallet or
            name) and the Normie it was about, to check later whether the advice held up. Deleted after 180 days.
          </li>
          <li>
            <strong>Hosting logs</strong> (Vercel): like any website, requests are logged by our host, including the
            page address, which can contain a wallet address you looked up. They are kept for the host&apos;s
            standard log period.
          </li>
          <li>
            <strong>Your browser</strong>: wagmi remembers your wallet connection, and we remember the last Normie
            you picked (local storage) and cache delegate lookups for 10 minutes (session storage). No tracking
            cookies, no ads, no analytics.
          </li>
        </ul>

        <h2>Who else sees data</h2>
        <ul>
          <li>
            <strong>Ask Zulo:</strong> your question, your connected wallet address or ENS name, and public on-chain
            data about the Normies involved go to an AI model provider (Venice, with xAI as a backup) to write the
            answer.
          </li>
          <li>
            <strong>Looking up a wallet</strong> sends that address to the services that answer it: the Normies
            API, Ethos, AgentCheck, OpenSea (offers, on Pixel Check) and a public Ethereum RPC. Market data (floor
            prices, listings) comes from OpenSea, Moralis and the Normies rarity site without any wallet.
          </li>
          <li>
            <strong>Burn helper</strong> may send the Normies and goal you picked (no wallet) to TypeSafe for a
            second opinion.
          </li>
          <li>
            <strong>Wallet connect</strong> uses RainbowKit and WalletConnect (Reown), which see that you connected.
          </li>
          <li>
            Infrastructure: Vercel (hosting), Supabase (database), Upstash (rate limits, counters). We don&apos;t
            sell data.
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

        <p className="legal-updated mono">Last updated 2026-10-19</p>
      </main>
      <SiteFooter />
    </div>
  )
}
