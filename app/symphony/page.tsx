import type { Metadata } from "next"

import { Chip } from "@/components/brand"
import { ConnectWallet } from "@/components/connect-wallet"
import { SiteFooter } from "@/components/site-footer"
import { SymphonyPlayer } from "@/components/symphony/player"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

import "../zulo/styles.css"
import "./symphony.css"

export const metadata: Metadata = {
  title: "Pixel Symphony — Normies CredHub",
  description:
    "Every Normie makes a sound. Type any Normie and hear its live on-chain pixels and traits as a song. Read-only, nothing to mint, nothing saved.",
}

export default function SymphonyPage() {
  return (
    <div className="zulo-chrome symphony-page">
      <ZuloChromeHeader
        trailing={
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <ConnectWallet />
          </span>
        }
      />
      <div className="header-spacer" aria-hidden />
      <main className="symphony-main">
        <header className="symphony-intro nb-grid-bg">
          <p className="hh-tags">
            <Chip>From live pixels</Chip>
            <Chip>Nothing to mint</Chip>
          </p>
          <h1 className="symphony-title">Pixel Symphony</h1>
          <p className="symphony-lede">
            The Normies hive is like mycelium: every face unique, all of them connected. One Normie makes a blip. Its
            pixels become the melody, its traits pick the instruments. Same Normie, same song, every time.
          </p>
        </header>

        <SymphonyPlayer defaultTokenId={7141} />

        <p className="symphony-note">
          How it reads: rows of pixels shape pitch and energy, the columns sweep left to right over one loop (the inverted
          column is the one playing). Type picks the scale and lead instrument; Expression, Age and Eyes shape the tone.
          Pulse and trust never touch the sound. Read-only: one look at the Normies API, nothing stored.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
