import type { Metadata } from "next"

import { Chip } from "@/components/brand"
import { ConnectWallet } from "@/components/connect-wallet"
import { SiteFooter } from "@/components/site-footer"
import { SymphonyPlayer } from "@/components/symphony/player"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { parseBlock, parseIds, symphonyPath } from "@/lib/symphony/pin"

import "../zulo/styles.css"
import "./symphony.css"

type Props = { searchParams: Promise<{ ids?: string; block?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams
  const ids = parseIds(sp.ids)
  const block = parseBlock(sp.block)
  const list = ids.length ? ids : [7141]
  const title =
    list.length === 1 ? `Normie #${list[0]} on Pixel Symphony — Normies CredHub` : `${list.length} Normies on Pixel Symphony — Normies CredHub`
  const description = `Hear on-chain pixels as music${block ? `, exactly as they were at block ${block}` : ""}. Read-only, nothing to mint, nothing saved.`
  const image = `/api/symphony/card?ids=${list.join(",")}${block ? `&block=${block}` : ""}`
  return {
    title,
    description,
    alternates: { canonical: symphonyPath(list, block) },
    openGraph: { title, description, url: symphonyPath(list, block), images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  }
}

export default async function SymphonyPage({ searchParams }: Props) {
  const sp = await searchParams
  const ids = parseIds(sp.ids)
  const block = parseBlock(sp.block)
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
            The Normies hive is like mycelium: every face unique, all of them connected. One Normie makes a blip; layer a
            few and they sing together. Pixels become the melody, traits pick the instruments. Same Normies, same block,
            same song, every time.
          </p>
        </header>

        <SymphonyPlayer initialIds={ids.length ? ids : [7141]} initialBlock={block} />

        <p className="symphony-note">
          How it reads: rows of pixels shape pitch and energy, the columns sweep left to right over one loop (the inverted
          column is the one playing). Type picks the scale and lead instrument; Expression, Age and Eyes shape the tone.
          Pulse and trust never touch the sound. Read-only: songs are recomputed from the Normies API, nothing is stored.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
