import Link from "next/link"

import {
  ethereumListing,
  NORMIES_CRED_PULSE,
  NORMIES_PATHS,
  type AgentToolListing,
  type OurAgentTool,
} from "@/lib/erc8257/our-tools"

function listingHref(listing: AgentToolListing): string | undefined {
  return listing.openseaUrl ?? listing.explorerUrl
}

function ToolId({ listing }: { listing: AgentToolListing }) {
  const href = listingHref(listing)
  const id = (
    <code className="agent-tool-id">{`#${listing.toolId}`}</code>
  )
  if (!href) return id
  return (
    <a
      href={href}
      className="agent-tool-id-link"
      target="_blank"
      rel="noreferrer"
    >
      {id}
    </a>
  )
}

function ToolListings({ tool }: { tool: OurAgentTool }) {
  return (
    <span className="agent-tool-listings">
      {tool.listings.map((listing, i) => (
        <span key={`${tool.slug}-${listing.chain}`}>
          {i > 0 ? " · " : null}
          {listing.chain === "ethereum"
            ? `${listing.label} Tool `
            : `${listing.label} `}
          <ToolId listing={listing} />
        </span>
      ))}
    </span>
  )
}

/** Full registry strip for PULSE — always visible, copyable IDs. */
export function AgentToolsStrip() {
  return (
    <aside className="agent-tools-strip" aria-label="Agent tools ERC-8257">
      <p className="agent-tools-kicker mono">Agent tools · ERC-8257</p>
      <ul className="agent-tools-list">
        <li>
          <span className="agent-tool-name">{NORMIES_CRED_PULSE.name}</span>
          {"  · "}
          <ToolListings tool={NORMIES_CRED_PULSE} />
        </li>
        <li>
          <span className="agent-tool-name">{NORMIES_PATHS.name}</span>
          {"  · "}
          <ToolListings tool={NORMIES_PATHS} />
        </li>
      </ul>
      <p className="agent-tools-manifests mono">
        Manifests:
        <br />
        <a href={NORMIES_CRED_PULSE.manifestPath}>
          {NORMIES_CRED_PULSE.manifestPath}
        </a>
        <br />
        <a href={NORMIES_PATHS.manifestPath}>{NORMIES_PATHS.manifestPath}</a>
      </p>
      <p className="agent-tools-note">
        Call Pulse first, then Paths. Same Normie NFT gate on Ethereum.
      </p>
    </aside>
  )
}

/** Quiet homepage line under the existing Tool #53 mention. */
export function AgentToolsHomeLine() {
  const pathsEth = ethereumListing(NORMIES_PATHS)
  return (
    <p className="caption text-center agent-tools-home">
      Also{" "}
      <Link href="/paths">{NORMIES_PATHS.name}</Link>
      {" · "}
      Ethereum Tool <ToolId listing={pathsEth} />. Call Pulse first.
    </p>
  )
}

/** Tiny Ask / Moves footer. */
export function AgentToolsFoot() {
  return (
    <p className="agent-tools-foot">
      Powered by {NORMIES_CRED_PULSE.name} + {NORMIES_PATHS.name} ·{" "}
      <Link href="/dashboard">see PULSE for registry IDs</Link>
    </p>
  )
}
