import type { Metadata } from "next"

import { ZuloExperience } from "@/components/agent-recommendations/zulo-experience"
import { AgentToolsFoot } from "@/components/agent-tools-block"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Ask — Normies CredHub",
  description: `Ask on Normies CredHub: high-signal concierge with Zulo (Agent #${ZULO_IDENTITY.agentId}, Normie #${ZULO_IDENTITY.tokenId}, Tool #53) for burns, tools, and Canvas — free Moves at /paths.`,
}

export default function AskPage() {
  return (
    <div className="zulo-chrome ask-page-wrap">
      <ZuloExperience defaultTokenId={ZULO_IDENTITY.tokenId} />
      <AgentToolsFoot />
    </div>
  )
}
