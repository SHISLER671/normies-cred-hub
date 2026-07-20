import type { Metadata } from "next"

import { ZuloExperience } from "@/components/agent-recommendations/zulo-experience"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Ask Zulo — Normie Agent Recommendations",
  description: `Talk with Zulo (Agent #${ZULO_IDENTITY.agentId}). Live PULSE, Canvas, rarity, and strategic recommendations for Normies.`,
}

export default function AskPage() {
  return (
    <div className="zulo-chrome min-h-screen">
      <ZuloExperience defaultTokenId={ZULO_IDENTITY.tokenId} />
    </div>
  )
}
