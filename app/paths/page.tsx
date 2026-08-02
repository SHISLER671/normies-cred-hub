import type { Metadata } from "next"

import { PathBoard } from "@/components/path-board"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"
import { ConnectWallet } from "@/components/connect-wallet"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Path Board — Zulo · NormiesCredHub",
  description:
    "Free Path Board: intent → ranked Normies paths for burns, tools, and Canvas. Rate 👍/👎 — credits the path and Zulo #32626.",
}

export default function PathsPage() {
  return (
    <div className="zulo-chrome min-h-screen">
      <ZuloChromeHeader
        active="paths"
        trailing={
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <ConnectWallet />
          </span>
        }
      />
      <div className="header-spacer" aria-hidden />
      <main style={{ paddingTop: 24 }}>
        <PathBoard defaultTokenId={ZULO_IDENTITY.tokenId} />
      </main>
    </div>
  )
}
