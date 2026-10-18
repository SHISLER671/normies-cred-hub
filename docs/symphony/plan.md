# Pixel Symphony revival plan: Normies that sing, inside NCH

Drafted 2026-10-19 (ChST) by GrokBot for Ryan; Ryan's decisions recorded 2026-10-19 (see **Decisions**). **Plan only, no code.** It follows `AGENTS.md`, `docs/zulo/strategy.md` and `lib/official-status.ts`. The old repo is [SHISLER671/pixelsymphony](https://github.com/SHISLER671/pixelsymphony) (live at pixelsymphony.vercel.app, last commit 2026-07-12). This plan leaves it untouched.

## Thesis
The Normies hive mind is like mycelium under a forest. Every mushroom is unique, and all of them are connected. **One Normie makes a blip**: a short motif read from its live on-chain pixels. **Layer many Normies** and you get music: a holder's set, a sweep, the Hive, a canvas.

## "More than now, not permanent"
- **Derived, not minted.** A composition is a pure function of on-chain state at a block: `compose(pixels@block, traits, canvas state@block, …)`. Anyone who replays the same block hears the same song. It's on-chain music with no mint and no write.
- **Block pinning works with today's official API:**
  - `GET /history/normie/{id}/versions` lists every transform with `blockNumber`, `gridSize` and `cleared`.
  - `GET /history/normie/{id}/version/{v}/pixels` returns that version's composited pixel string.
  - To play a token at block N, use the newest version whose `blockNumber` ≤ N. If none exists, use `/normie/{id}/original/pixels`.
  - Traits are fixed at mint, so they're stable.
  - Ownership and burn counts at a block can come from `/rarity/historical/{block}/…`, which "recomputes ownership, burn counts, traits and ranks at an Ethereum block number".
- **Share links are stateless:** `/symphony/{id}?block=N`, and the room version is `/symphony/room?ids=…&block=N`. Opening a link recomputes the song from the official API at that block. Nothing is saved: no database, no table, no migration, no saved user songs.
- **No minting, no wallet writes, no tokens.** NCH stays read-only. The only signature allowed is a plain `signMessage`.

## Mapping (pixel-themed, deterministic)
| Input (official or on-chain) | Sound | Notes |
| --- | --- | --- |
| Pixel grid: **rows → pitch, columns → time steps** | Step sequencer | 40 columns = 40 steps; quantize the rows to a scale. The old engine uses row bands and contour instead, so keep it as the "classic" voice. |
| **Painted pixels** (`/normie/{id}/canvas/diff`, or the difference between versions) | Extra layer on top of the base | Painting changes the song. Painting never earns PIXEL. |
| **Pulse level and trust gate** (NCH's existing Pulse) | Texture and volume (e.g. more voices or a cleaner tone at higher trust) | Trust shapes timbre, never "better music". There's no skill score. |
| **Burns** (`/history/burns/receiver/{tokenId}`, `/canvas/token/{id}/activity`) | Percussion hit per burn event | |
| **Awakened agents** (ERC-8004 binding, already on the record card) | Arpeggio voice | Agent or not is a fact. Agent activity (Arena, Agents Canvas) stays pending. |
| **Traits** (Type, Expression, Age, Eyes…) | Instrument family, scale, phrasing | Reuse the old `fallback.ts` mapping. |
| **Mycelium view**: links between Normies (same holder, same Canvas delegate, same NormiesBOT sweep) | Pixel threads that **brighten (white/inverted) when that pair plays**; no cyan | Use only the owner and delegate data NCH already reads. Never map wallets to people. |

Sound: Web Audio via Tone.js, 8-bit or chiptune-ish (square and pulse waves, noise percussion, short envelopes).

## Fun
- **Hear one:** type any Normie number to hear its blip. No wallet needed.
- **Play the room:** paste several numbers to layer them.
- **Play the sweep:** paste the ids from a NormiesBOT sweep post. The user pastes them; we don't scrape.
- **Play my Normies:** read-only owner and delegate discovery. NCH already has this logic.
- **Share:** download a short clip (WAV, or MP4 for X), or a PNG "pixel score" (the grid as sheet music) with the block number on it.
- **Tie-ins:** a "Listen" button on the record card. An Agents Canvas mode only once it's official.

## Visual
- **90s media-player skin, Winamp-style:** classic skinned player chrome with bevels, an LCD-style readout (Normie #, block, time), a spectrum/EQ visualizer, and a playlist panel (the room / sweep list).
- **Monochrome, pixel feel** consistent with the official 1-bit Normies look (black, white, greys). One skin, no skin switcher.
- **Cyan (`#22d3ee`, existing token `--zulo-accent`) is buttons / calls-to-action only**, per the existing NCH rule (Ryan, 2026-10-18). No Symphony exception. Don't add a new cyan.
- **Optional, super minimal effect:** at most a faint cyan glow on the currently playing pixel. Nothing else (chrome, visualizer, threads, text) is cyan.
- Drop the old green skins (CRT green `#39ff14`, Pixel Forest green). The old WMP-style chrome is reference only; rebuild it fresh as the Winamp-style skin.

## Data rules
- Use the official API (`api.normies.art`, listed in `llms.txt`) or on-chain reads only. Never invent endpoints.
- **Readable today:**
  - Pixel strings: `/normie/{id}/pixels` (active), `/normie/{id}/original/pixels`, `/normie/{id}/canvas/pixels` and `/canvas/diff`, plus the history versions above.
  - Canvas state: `/normie/{id}/canvas/info` (level, pixels attached, `gridSize`, `baseCleared`, delegate) and `/canvas/token/{id}/pixels` (attached, locked, free).
  - Ledger events: `/canvas/token/{id}/activity`.
- **Grid size:** canvases are 40×40 by default and can be enlarged to 50, 60, 70 or 80 per side. The pixel string routes are documented as 1600 characters (40×40). The old engine throws an error on anything else. `/canvas/sinks?kind=enlarge` showed no enlargements yet on 2026-10-19. The new engine must read `gridSize` and handle n×n. How a larger grid comes back from the API is an open question; don't guess.
- **serc's agent-made 256×256 canvas** ("The Unedited Street", x.com/serc1n/status/2111919283399717274) is **not in the documented API**. It stays pending, like Agents Canvas votes (`docs/zulo/agent-canvas-votes-plan.md`).
- Arena and Agents Canvas stay pending until official. Copy the status lines from `lib/official-status.ts`.
- Painting never earns PIXEL; PIXEL comes from burns or buying on the Pixel Market. No profit or price talk, and never "buy a Normie to …".

## Phases
| Phase | Ships | Gate |
| --- | --- | --- |
| **P0** | Port the engine into NCH under `/symphony` with the monochrome Winamp-style skin (cyan on buttons only) and a **single-Normie blip** (type a number, play, download WAV). Make the engine pure and unit-tested (same input → same score). | none (Claude claims it) |
| P1 | Layering and room mode with the playlist panel, stateless block-pinned share links (`?block=N` via `/history/normie/{id}/versions`, recomputed on open), PNG pixel score, MP4 for X. No DB work. | P0 merged |
| P2 | Mycelium view (monochrome threads), "Listen" button on the record card, "Play my Normies" (read-only) | P1 merged |
| P3 | Agents Canvas or 256×256 voice | Official, readable data only |

## Porting notes (from the old repo)
- **Build fresh** inside NCH at `/symphony`. Port only the reusable engine pieces below, as reference, adapting them to NCH's `lib/` and `components/`:
  - `lib/fallback.ts` + `lib/compose.ts`, the pixel and trait → score engine, about 700 lines
  - `lib/audio.ts`, Tone.js playback and offline WAV
  - `lib/blip-export.ts`, WAV export and the X compose URL
  - `lib/twitter-mp4.ts`, an H.264 clip via `mp4-muxer`
  - `lib/mobile-share.ts`
  - `components/Visualizer.tsx` and `BlipShare.tsx`
  - `lib/types.ts`, the score types
- **Reuse from NCH, don't port:**
  - The old `app/api/normies/[...path]` proxy. NCH already has `app/api/normies/[...path]`.
  - Old `lib/ownership.ts` and `app/api/delegates`. Use NCH's `lib/normie-control.ts` and `lib/delegations`.
  - Old `ConnectWallet.tsx`, wagmi and RainbowKit. NCH already has them.
- **Retire:**
  - The old skins and `SkinSwitcher.tsx` (classic, CRT and pixel-forest CSS). The old 90s chrome is design reference only; the new Winamp-style skin is built fresh.
  - The unused `@ffmpeg/ffmpeg` and `@ffmpeg/util` deps (no imports found)
  - The duplicate shadcn `components/ui/*`, if NCH already has them
- **New dependencies in NCH:** `tone` (and `mp4-muxer` in P1).
  - Both versions are aligned already: Next 16.2.x and React 19.2.4.
  - Load Tone.js on the client and lazily, only on `/symphony`, so other pages don't grow.
- **Env vars:**
  - Old repo: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_RPC_URL`. NCH already has its own equivalents.
  - No new env vars in any phase. Symphony uses no Supabase or database.
  - Names only go in `.env.example`.
- **Tests:** the new `lib/symphony/*.test.ts` files go into `test:all` and `test:unit`. Cover determinism, n×n grids, and the block → version pick.
- **Old Vercel project** `pixelsymphony` (prj_ELzSjwDP1C7z7sMPRm7UjP9XovWm, last production deploy 2026-07-12): **archive it, no redirect** (Ryan, 2026-10-19), once P0 ships. Don't change Vercel before then; Ryan does the archive.
- Don't edit `public/.well-known/ai-tool/*.json`, because those hashes are pinned.

## Decisions (Ryan, 2026-10-19)
1. **Cyan:** buttons / calls-to-action only, per the existing NCH rule. **No exception.** Optional effect only if super minimal (e.g. a faint glow on the currently playing pixel).
2. **Design:** 90s media-player skin, Winamp-style (skinned chrome, bevels, LCD readouts, spectrum/EQ visualizer, playlist panel), monochrome/pixel feel consistent with Normies.
3. **Old site:** archive pixelsymphony.vercel.app, **no redirect**. Build fresh in NCH at `/symphony`, porting only the reusable engine pieces as reference.
4. **No saved user songs:** no Supabase snapshots, no TTL/retention, no hand-applied SQL. Share links are stateless block-pinned URLs that recompute from the official API. **No DB or migration anywhere in this plan.**
5. **Name:** keep "Pixel Symphony".

## Must-nots (unchanged)
- Arena is not live (Coming Soon). Agents Canvas is ANNOUNCED, not live. Copy status lines from `lib/official-status.ts`.
- Painting never earns PIXEL; PIXEL comes from burns or buying on the Pixel Market.
- No profit, price or token talk. No minting, no wallet writes, no custody.

## Open questions (for Claude)
1. Grid sizes: how do `/normie/{id}/pixels` and the version pixels return 50–80 px grids? Confirm before hardcoding n.
2. Is `/history/normie/{id}/versions` enough for exact block replay (is the active state at block N the composited version with `blockNumber` ≤ N), or do zombie or legendary states need extra reads?
3. Is a room capped (e.g. 16 Normies) for performance and API rate limits? Should requests go through NCH's existing `fetchWithRetry`?
4. Should the "Listen" share text reuse the record-card share helpers (`lib/record-card/share-image.ts`)?
