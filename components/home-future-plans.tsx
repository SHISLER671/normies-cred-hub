"use client"

import {
  PulseAccordion,
  PulseAccordionItem,
} from "@/components/pulse-accordion"

type HomeFuturePlansProps = {
  tokenId: number
  ens: string
  hotWallet: string
}

/**
 * Homepage Future Plans — single collapsed shell with nested prepared items.
 * Reuses PULSE monochrome accordion language.
 */
export function HomeFuturePlans({
  tokenId,
  ens,
  hotWallet,
}: HomeFuturePlansProps) {
  return (
    <section className="section section-bordered">
      <div className="container home-future-wrap">
        <PulseAccordion defaultOpenIds={[]} allowMultiple className="home-future-outer">
          <PulseAccordionItem
            id="future-plans"
            title="Future Plans"
            subtitle="Tips, PULSE expansion, how to pay when live"
          >
            <PulseAccordion
              defaultOpenIds={[]}
              allowMultiple
              className="home-future-nested"
            >
              <PulseAccordionItem
                id="tips-tba"
                title="On-chain tips & TBA"
                subtitle="Prepared"
              >
                <p className="card-body" style={{ margin: 0 }}>
                  Scaffold ready for A2A tips and #{tokenId} TBA when serc
                  enables x402 + ERC-6551. No autonomous transactions today. See{" "}
                  <a href="/api/zulo/manifest" className="mono">
                    /api/zulo/manifest
                  </a>{" "}
                  for payment how-to when status flips to live.
                </p>
              </PulseAccordionItem>

              <PulseAccordionItem
                id="pulse-expansion"
                title="PULSE Expansion"
                subtitle="In development"
              >
                <p className="card-body" style={{ margin: 0 }}>
                  Real-time PULSE data for all Normies. Every awakened agent
                  connected, every opportunity surfaced — across CredHub, not
                  only one agent.
                </p>
              </PulseAccordionItem>

              <PulseAccordionItem
                id="how-to-pay"
                title="How to pay Zulo (when live)"
                subtitle="A2A tips · planned"
              >
                <ol
                  className="card-body"
                  style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}
                >
                  <li>
                    Discover services via{" "}
                    <a href="/api/zulo/manifest">
                      <code className="mono">GET /api/zulo/manifest</code>
                    </a>
                  </li>
                  <li>Pick a paid service (1 AP analysis · 2 AP strategy)</li>
                  <li>
                    Transfer AP to <code className="mono">{hotWallet}</code>{" "}
                    (or the Canvas path Normies A2A specifies)
                  </li>
                  <li>
                    Call <code className="mono">POST /api/zulo/ask</code> with{" "}
                    <code className="mono">service</code> +{" "}
                    <code className="mono">txHash</code>
                  </li>
                  <li>
                    Until rails are live: free Moves at /paths and free chat at
                    /ask — no payment required
                  </li>
                </ol>
                <p className="caption" style={{ marginTop: 16, marginBottom: 0 }}>
                  Receiver wallet · {ens} · Normie #{tokenId}
                </p>
              </PulseAccordionItem>
            </PulseAccordion>
          </PulseAccordionItem>
        </PulseAccordion>
      </div>
    </section>
  )
}
