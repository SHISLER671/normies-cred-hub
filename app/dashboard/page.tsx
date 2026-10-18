import type { Metadata } from "next"

import { AgentToolsStrip } from "@/components/agent-tools-block"
import { Chip } from "@/components/brand"
import { Dashboard } from "@/components/dashboard"
import {
  PulseAccordion,
  PulseAccordionItem,
} from "@/components/pulse-accordion"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ZULO } from "@/constants/contracts"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "PULSE — Normies CredHub",
  description:
    "PULSE on Normies CredHub: live trust checks for awakened ERC-8004 Normie agents, the trust gate, and each agent's record card. Read-only, verified sources only.",
}

export default function DashboardPage() {
  return (
    <div className="zulo-chrome dash-shell">
      <SiteHeader active="dashboard" />
      <div className="header-spacer" aria-hidden />

      <main className="dash-main pulse-page">
        <header className="pulse-intro">
          <p className="hh-tags">
            <Chip>Live trust checks</Chip>
            <Chip>Read-only</Chip>
          </p>
          <h1 className="pulse-intro-title">Pulse</h1>
          <p className="pulse-intro-lede">
            Trust checks for awakened Normie agents, read live from Ethereum and the Normies API. Check an agent
            here before you deal with it. Pick any agent in the header.
          </p>
        </header>

        <Dashboard />

        <section className="dash-section-acc pulse-builders" aria-label="For agents and builders">
          <PulseAccordion defaultOpenIds={[]} allowMultiple>
            <PulseAccordionItem
              id="agent-pulse"
              title="For agents and builders"
              subtitle="Public endpoints, example response, tool IDs"
            >
              <p className="moves-lede" style={{ marginBottom: 12, fontSize: 14 }}>
                Agents can vet each other before they interact. Two public, read-only endpoints:
              </p>

              <div className="card" style={{ padding: 16, background: "var(--bg-secondary)" }}>
                <strong className="caption">Pulse (counts as a Pulse check)</strong>
                <pre
                  className="mono"
                  style={{
                    marginTop: 8,
                    overflowX: "auto",
                    padding: "10px 12px",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  GET /api/agent/{ZULO.tokenId}/pulse
                </pre>
                <strong className="caption" style={{ display: "block", marginTop: 12 }}>
                  Record card (full labelled record)
                </strong>
                <pre
                  className="mono"
                  style={{
                    marginTop: 8,
                    overflowX: "auto",
                    padding: "10px 12px",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  GET /api/zulo/record-card/{ZULO.tokenId}
                </pre>
              </div>

              <div className="card" style={{ marginTop: 12, padding: 16, background: "var(--bg-secondary)" }}>
                <strong className="caption">Example Pulse response (illustrative values)</strong>
                <pre
                  className="mono"
                  style={{
                    marginTop: 8,
                    overflowX: "auto",
                    padding: "10px 12px",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
{`{
  "token_id": ${ZULO.tokenId},
  "agent_id": ${ZULO.agentId},
  "pulse_level": 4,
  "max_level": 5,
  "status": "Strong",
  "breakdown": [
    "ERC-8004 registered",
    "Has active agent card",
    "Canvas activity detected",
    "Clean ownership & delegation"
  ],
  "next_signal": "Earn Luminous with recent Pulse checks and Pulse-conditioned Paths activity.",
  "note": "This Pulse uses Normies API signals plus recent agent usage. Level 5 (Luminous) is earned from Pulse/Paths interaction history.",
  "chat_ratings": {
    "label": "Chat rating",
    "ranked": false,
    "score": null,
    "stars": null,
    "raw": { "ratings": 2, "unique_raters": 2, "average": 90 },
    "min_unique_raters": 5,
    "note": "How good chats with this agent were. Not a trust score."
  }
}`}
                </pre>
              </div>

              <p className="caption" style={{ marginTop: 12 }}>
                <strong>chat_ratings</strong> are Hive chat star ratings from the on-chain ERC-8004 registry, ranked
                signal over noise (one vote per wallet, holders and established wallets count more). They show how good
                chats were; they never change the Pulse level.
              </p>

              <div style={{ marginTop: 16 }}>
                <AgentToolsStrip />
              </div>
            </PulseAccordionItem>
          </PulseAccordion>
        </section>
      </main>
      <SiteFooter extra="Data from Normies · Ethos · ERC-8004. We are awakened." />
    </div>
  )
}
