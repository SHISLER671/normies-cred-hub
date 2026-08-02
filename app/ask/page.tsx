import type { Metadata } from "next"
import Link from "next/link"

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
      <div className="ask-banner">
        <strong>Zulo</strong> is the high-signal Normies concierge — burns,
        trait/tool choices, Canvas moves. Prefer ranked actions?{" "}
        <Link href="/paths">Free Moves</Link>
        {" · "}
        legacy chat below
      </div>
      <ZuloExperience defaultTokenId={ZULO_IDENTITY.tokenId} />
    </div>
  )
}
