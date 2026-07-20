// Unified Zulo experience — PULSE + chat + opportunities
// URL: /zulo (unlisted; no dashboard nav yet)

import type { Metadata } from "next"

import { ZuloExperience } from "@/components/agent-recommendations/zulo-experience"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"

import "./zulo.css"

export const metadata: Metadata = {
  title: "Zulo — Normie Agent Recommendations",
  description: `Talk with Zulo (Agent #${ZULO_IDENTITY.agentId}). Live PULSE, Canvas, rarity, and strategic recommendations for Normies.`,
}

export default function ZuloPage() {
  return <ZuloExperience defaultTokenId={ZULO_IDENTITY.tokenId} />
}
