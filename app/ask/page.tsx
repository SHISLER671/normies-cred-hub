import type { Metadata } from "next"

import { ZuloExperience } from "@/components/agent-recommendations/zulo-experience"
import { AgentToolsFoot } from "@/components/agent-tools-block"
import { SiteFooter } from "@/components/site-footer"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "Ask — Normies CredHub",
  description: `Ask on Normies CredHub: high-signal concierge with Zulo (Agent #${ZULO_IDENTITY.agentId}, Normie #${ZULO_IDENTITY.tokenId}, Tool #53) for burns, tools, and Canvas — free Moves at /paths.`,
  alternates: { canonical: "/ask" },
  openGraph: { title: "Ask — Normies CredHub", url: "/ask", siteName: "Normies CredHub", type: "website", images: [{ url: "/og.png", width: 1200, height: 630 }] },
}

export default function AskPage() {
  return (
    <div className="zulo-chrome ask-page-wrap">
      <ZuloExperience defaultTokenId={ZULO_IDENTITY.tokenId} />
      <AgentToolsFoot />
      <SiteFooter />
    </div>
  )
}
