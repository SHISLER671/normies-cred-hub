import type { Metadata } from "next"
import Link from "next/link"

import { ZuloExperience } from "@/components/agent-recommendations/zulo-experience"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Ask Zulo — Normie Agent Recommendations",
  description: `Talk with Zulo (Agent #${ZULO_IDENTITY.agentId}). High-signal Normies concierge for burns, tools, and Canvas — free Path Board at /paths.`,
}

export default function AskPage() {
  return (
    <div className="zulo-chrome min-h-screen">
      <div
        style={{
          borderBottom: "1px solid var(--border, #1a1a1a)",
          padding: "10px 16px",
          textAlign: "center",
          fontSize: 13,
          lineHeight: 1.45,
          background: "var(--card, #f0f0f0)",
        }}
      >
        <strong>Zulo</strong> is the high-signal Normies concierge — burns,
        trait/tool choices, Canvas moves. Prefer ranked paths?{" "}
        <Link
          href="/paths"
          style={{
            color: "inherit",
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Free Path Board
        </Link>
        {" · "}
        legacy chat below
      </div>
      <ZuloExperience defaultTokenId={ZULO_IDENTITY.tokenId} />
    </div>
  )
}
