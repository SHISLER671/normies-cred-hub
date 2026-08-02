import type { Metadata } from "next"

import { ZuloExperience } from "@/components/agent-recommendations/zulo-experience"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Ask Zulo — Normie Agent Recommendations",
  description: `Talk with Zulo (Agent #${ZULO_IDENTITY.agentId}). High-signal Normies concierge for burns, tools, and Canvas — free Moves at /paths.`,
}

export default function AskPage() {
  return (
    <div className="zulo-chrome ask-page-wrap">
      <ZuloExperience defaultTokenId={ZULO_IDENTITY.tokenId} />
    </div>
  )
}
