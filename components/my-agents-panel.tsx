"use client"

import { useActiveNormie } from "@/components/active-normie-provider"
import { normieImageUrl } from "@/lib/api/normies"
import { cn } from "@/lib/utils"

/**
 * PULSE “My agents” grid — controlled + delegated Normies for the connected wallet.
 */
export function MyAgentsPanel() {
  const {
    controlledNormies,
    activeTokenId,
    setActiveTokenId,
    isLoading,
    hasWallet,
  } = useActiveNormie()

  if (!hasWallet) {
    return (
      <section className="my-agents-panel">
        <p className="my-agents-kicker mono">My agents</p>
        <p className="my-agents-empty">
          Connect your wallet to see Normies you own or control via Canvas
          delegate.
        </p>
      </section>
    )
  }

  return (
    <section className="my-agents-panel">
      <div className="my-agents-head">
        <p className="my-agents-kicker mono">My agents</p>
        <p className="my-agents-count mono">
          {isLoading ? "…" : `${controlledNormies.length} controlled`}
        </p>
      </div>

      {isLoading ? (
        <p className="my-agents-empty">Loading your agents…</p>
      ) : controlledNormies.length === 0 ? (
        <p className="my-agents-empty">
          No controlled or delegated Normies found for this wallet.
        </p>
      ) : (
        <ul className="my-agents-grid">
          {controlledNormies.map((n) => {
            const active = n.tokenId === activeTokenId
            return (
              <li key={n.tokenId}>
                <button
                  type="button"
                  className={cn("my-agent-card", active && "is-active")}
                  onClick={() => setActiveTokenId(n.tokenId)}
                  aria-pressed={active}
                >
                  <span className="my-agent-pixel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={normieImageUrl(n.tokenId)}
                      alt={`Normie #${n.tokenId}`}
                      width={48}
                      height={48}
                    />
                  </span>
                  <span className="my-agent-meta">
                    <span className="mono my-agent-id">#{n.tokenId}</span>
                    <span className="my-agent-status">
                      {n.isAwakened ? "Awakened" : n.type || "Normie"}
                    </span>
                    {active ? (
                      <span className="my-agent-active-tag mono">Active</span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
