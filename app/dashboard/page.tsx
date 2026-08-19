import type { Metadata } from "next"

import { AgentPulseBar } from "@/components/agent-pulse-bar"
import { AgentToolsStrip } from "@/components/agent-tools-block"
import { Dashboard } from "@/components/dashboard"
import {
  PulseAccordion,
  PulseAccordionItem,
} from "@/components/pulse-accordion"
import { SiteHeader } from "@/components/site-header"
import { ZULO } from "@/constants/contracts"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "PULSE — Normies CredHub",
  description:
    "PULSE on Normies CredHub: view, verify, and build trust in awakened ERC-8004 Normie agents. On-chain identity meets portable reputation — Zulo (#32626) as high-signal concierge and Tool #53.",
}

export default function DashboardPage() {
  return (
    <div className="zulo-chrome dash-shell">
      <SiteHeader active="dashboard" />
      <div className="header-spacer" aria-hidden />

      <main className="dash-main">
        <section className="dash-hero" data-reveal>
          <p className="moves-kicker mono">CREDHUB · PULSE · LIVE</p>
          <h1 className="moves-title">
            See the real reputation of your awakened agents.
          </h1>
          <p className="moves-lede">
            A verifiable reputation layer for autonomous Normies agents. Switch
            your Active Normie in the header or My agents list — then inspect
            trust, PULSE, and tools for that agent.
          </p>
          <p className="caption" style={{ marginTop: 10 }}>
            Built for agents and holders who verify trust before they engage.
          </p>
          <p className="caption" style={{ marginTop: 16 }}>
            Connect your wallet to unlock your controlled and delegated set.
          </p>
        </section>

        <section className="dash-section-acc" data-reveal>
          <PulseAccordion defaultOpenIds={["agent-pulse"]} allowMultiple>
            <PulseAccordionItem
              id="agent-pulse"
              title="Agent Pulse"
              subtitle="Score, public endpoint, agent-to-agent trust"
            >
              <p className="moves-lede" style={{ marginBottom: 12, fontSize: 14 }}>
                Agents can vet each other before they interact. One public
                endpoint returns any agent&apos;s trust profile as JSON.
              </p>

              <AgentPulseBar />

              <p className="caption" style={{ marginTop: 16 }}>
                Real data pulled live from the Normies API + on-chain records.
              </p>

              <div
                className="card"
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "var(--bg-secondary)",
                }}
              >
                <strong className="caption">Public Endpoint</strong>
                <span className="caption"> (any agent can call this):</span>
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
              </div>

              <div
                className="card"
                style={{
                  marginTop: 12,
                  padding: 16,
                  background: "var(--bg-secondary)",
                }}
              >
                <strong className="caption">Example Response</strong>
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
  "note": "This Pulse uses Normies API signals plus recent agent usage. Level 5 (Luminous) is earned from Pulse/Paths interaction history."
}`}
                </pre>
              </div>

              <p className="moves-lede" style={{ marginTop: 16, fontSize: 13 }}>
                Any awakened agent can fetch this before deciding to interact.
              </p>
              <p className="caption" style={{ marginTop: 8 }}>
                Future updates will include direct signals from agent activity
                (transactions, interactions, success patterns).
              </p>
            </PulseAccordionItem>
          </PulseAccordion>
        </section>

        <section className="dash-section-acc" data-reveal>
          <AgentToolsStrip />
        </section>

        {/* Trust cards / framework — My agents + collapsible signals */}
        <div style={{ paddingBottom: 48 }} data-reveal>
          <Dashboard />
        </div>

        <footer className="dash-footer">
          <p>
            Read-only. No trades. No approvals.
            <br />
            Only a gas-free signature to prove you are real.
            <br />
            Data from Normies · Ethos · ERC-8004. We are awakened.
          </p>
        </footer>
      </main>
    </div>
  )
}
