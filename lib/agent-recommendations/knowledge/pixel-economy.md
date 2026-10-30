# Pixel Economy — Deep Dive (Zulo Knowledge Base)

Authoritative framing for strategy answers. Prefer live context numbers when present; use this as mechanics doctrine when explaining *why*.

## 1. Action Points (AP)

### How AP is earned

- **AP (#PIXEL) comes from burning or from the Pixel Market** (official docs: "Pixels come from burning other Normies, or from the Pixel Market."). A burn is commit → wait → reveal.
- Burn rewards land **on a Normie you own or in your wallet** (official docs: "The pixels land on a Normie you own, raising its ceiling, or in your wallet, ready to put on any Normie you own or to list on the Pixel Market."). Pixels already on a burned Normie move across whole.
- A pixel is either **on a Normie** (its painting ceiling) or **loose in a wallet**. There is **no wallet-to-wallet transfer**: pixels move between wallets only through a Pixel Market trade, and deposits onto other people's Normies are refused.
- Reveal RNG sits inside **pixel-count tiers**:
  - under 490 on-pixels → ~1–4% of pixels as AP
  - 490–889 → ~2–4%
  - 890+ → ~3–4% (best efficiency band)
- Miss the reveal window → **minimum band only**. Burns are permanent.

### Appearance / customize (not an AP debit)

- AP is **not spent** when you draw / customize / preview.
- Official customize uses **#PIXEL as pixel budget** (**1 PIXEL = 1 pixel**) in official Normies UI — not an AP debit.
- Preview on **Normifier** before you commit a canvas edit in official UI.
- CredHub / Normifier preview is **not** a spend rail. Holder draws / canvases only at official Normies UI.
- Never tell a visitor AP is spent, used, paid, or debited to change appearance.
- Never: “customize to earn PIXEL”. Example-state #7141 (~12 AP) may be named as **holdings**, never as a canvas price.
- Level = pixels on the Normie / 10 + 1, read live (official docs). Putting pixels on raises it; taking them off, or paying for a size change from the Normie, lowers it.
- Delegation: transform-only; cannot burn, claim, or transfer.

### Tradeability & sacrificial economy

- Today: AP is created by sacrifice (burn fodder → keep/edit favorites) and can change hands on the Pixel Market.
- **#PIXEL = Action Points (AP), not a separate coin** (Serc / @normiesART). The **PIXEL MARKET is live** (official docs and /lab list it as Live): sell-side listings priced in ETH per pixel, settled on chain. Its official rules (fee, floor, cooldown, revenue share) are in the Dual Evaluation block, which takes precedence over older notes. You have no live prices: never invent prices, order-book depth or hold-thresholds. A burn pays on the ORIGINAL pixel count; edited art does not raise yield.
- Doctrine: this is a **sacrificial economy**. Value flows from permanent burns into scarce edit budget and future arena power. Treat AP as earned capital, not free spins.
- **Burn vs hold is dual-frame** — see `knowledge/dual-evaluation-and-pixel-market.md` (high-px efficiency vs extreme low-px collectible scarcity).

## 2. Canvas expansion (40×40 → 80×80)

### Current state

- Grid: **40×40** (1600 pixels), on-chain monochrome bitmap.
- Blank / sparse canvases: high negative space — good for planned composition, weak as burn fodder if on-pixel count is low.
- Dense canvases (890+ on-px): stronger burn yield bands if used as fodder; less headroom for additive art.

### Bigger and blank canvases (live, official docs)

- A canvas can grow from 40×40 to **50, 60, 70 or 80** per side, art centred. At launch that costs **900, 2,000, 3,300 or 4,800 pixels** in total, one per pixel added, and an upgrade costs the difference. A **blank canvas** drops the base art for **200 pixels**. Both are paid from the wallet or from the Normie, and both burn the pixels out of circulation. Paying from the Normie lowers its Level.
- Readiness stack (Zulo's own planning heuristic, NOT an official requirement):
  1. **AP accumulation** — enough budget to matter on a larger grid
  2. **Pixel density** — composition in a flexible band (avoid both empty and maxed-out faces)
  3. **Level / activity** — proven Canvas use without panic edits
- Placement strategy: contiguous strokes > scatter noise; protect facial landmarks; stage transforms; Normifier before commit.
- First edit ends **purist/untouched** narrative premium — price that decision deliberately.

## 3. Gacha & raffles (status facts only)

- Report only what a feed publishes: pool / raffle counts, status, entry cost, field size, pity counters and qualification gates (min AP, holder-only, awakened-only)
- Always label the unit (AP, ETH)
- Never call a pull or raffle "+EV", "worth it" or a good bet; never suggest how much AP to put in; never imply returns
- When no feed is live, say so — never invent odds, pools or prizes

## 4. Zulo’s role in the pixel economy

Zulo is the **Strategic Architect** of this stack:

| Function | What he does |
|----------|----------------|
| **Report facts** | Floor snapshot, burn history medians, labelled AP estimates, official #PIXEL pixel budget, gacha/raffle counts, expansion readiness scores |
| **Alert on inefficiencies** | Floor shocks, burn spikes, whale-scale clusters, significant canvas transforms, low-confidence data |

He does **not** run a casino desk. He runs an **arena dashboard**: structure and facts. Burn/buy questions go to /burn (a vibe check, not financial advice).

## 5. Operating principles (quick)

1. Patience compounds. Haste erodes.
2. We don't chase pumps. We stack pixels.
3. The market signals… only what you can measure (floor, burns, pulse, density).
4. Prefer irreversible decisions only with explicit user intent.
5. When rails are **planned** (gacha feeds; official "Later": Spin to Win, Mural, Merch), say so — never invent live books or prices.

## 6. Live skills that implement this doctrine

- PIXEL MARKET Sentinel — floor / burn / whale intelligence
- Gacha & Raffle status — feed status, counts, pity, qualification
- Canvas Evolution Advisor — preview transforms, 80×80 readiness, canvas watch

Use live `platformContext` payloads when present; fall back to this doctrine for mechanics and philosophy.
