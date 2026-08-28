import type { Metadata } from "next"

import { AgentToolsFoot } from "@/components/agent-tools-block"
import { PathBoard } from "@/components/path-board"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { ConnectWallet } from "@/components/connect-wallet"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Moves — Normies CredHub",
  description:
    "Free Moves on Normies CredHub: intent → ranked Normies actions for burns, tools, and Canvas. Rate 👍/👎 — credits the move and Zulo #32626.",
}

export default function PathsPage() {
  return (
    <div className="zulo-chrome min-h-screen">
      <ZuloChromeHeader
        active="moves"
        trailing={
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <ConnectWallet />
          </span>
        }
      />
      <div className="header-spacer" aria-hidden />
      <main style={{ paddingTop: 8, paddingBottom: 24 }}>
        <PathBoard defaultTokenId={ZULO_IDENTITY.tokenId} />
        <AgentToolsFoot />
      </main>
    </div>
  )
}
