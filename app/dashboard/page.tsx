import type { Metadata } from "next"

import { AgentPulseBar } from "@/components/agent-pulse-bar"
import { Dashboard } from "@/components/dashboard"
import { SiteHeader } from "@/components/site-header"
import { ZULO } from "@/constants/contracts"

import "../zulo/styles.css"

export const metadata: Metadata = {
  title: "PULSE — Zulo · NormiesCredHub",
  description:
    "View, verify, and build trust in your awakened ERC-8004 Normie agents. On-chain identity meets portable reputation.",
}

export default function DashboardPage() {
  return (
    <div className="zulo-chrome dash-shell">
      <SiteHeader active="dashboard" />
      <div className="header-spacer" aria-hidden />

      <main className="dash-main">
        <section className="dash-hero">
          <p className="moves-kicker mono">CREDHUB · AWAKENED · LIVE</p>
          <h1 className="moves-title">
            See the real reputation of your awakened agent.
          </h1>
          <p className="moves-lede">
            A verifiable reputation layer for autonomous Normies agents. Public
            trust profiles for every agent. Connect your wallet to see your own.
          </p>
          <p className="caption" style={{ marginTop: 16 }}>
            Connect your wallet to unlock personalized features for your agent.
          </p>
        </section>

        <section className="dash-section">
          <p className="dash-section-title mono">Agent-to-agent trust</p>
          <h2
            className="moves-title"
            style={{ fontSize: 22, marginBottom: 8 }}
          >
            Agents can vet each other before they interact.
          </h2>
          <p className="moves-lede" style={{ marginBottom: 16 }}>
            One public endpoint returns any agent&apos;s trust profile as JSON —
            no dashboard required.
          </p>

          <AgentPulseBar />

          <p className="caption" style={{ marginTop: 16 }}>
            Real data pulled live from the Normies API + on-chain records.
          </p>

          <div
            className="card"
            style={{ marginTop: 16, padding: 16, background: "var(--bg-primary)" }}
          >
            <strong className="caption">Public Endpoint</strong>
            <span className="caption"> (any agent can call this):</span>
            <pre
              className="mono"
              style={{
                marginTop: 8,
                overflowX: "auto",
                padding: "10px 12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                fontSize: 13,
              }}
            >
              GET /api/agent/{ZULO.tokenId}/pulse
            </pre>
          </div>

          <div
            className="card"
            style={{ marginTop: 12, padding: 16, background: "var(--bg-primary)" }}
          >
            <strong className="caption">Example Response</strong>
            <pre
              className="mono"
              style={{
                marginTop: 8,
                overflowX: "auto",
                padding: "10px 12px",
                background: "var(--bg-secondary)",
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
  "next_signal": "Reserved for future on-chain usage metrics — there's always room for improvement.",
  "note": "This Pulse uses currently available signals from the Normies API. The 5th level unlocks as more agents transact and interact on-chain in future updates."
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
        </section>

        {/* Trust cards / Pulse / framework — content unchanged */}
        <div style={{ paddingBottom: 48 }}>
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
