# Pixel Economy — Deep Dive (Zulo Knowledge Base)

Authoritative framing for strategy answers. Prefer live context numbers when present; use this as mechanics doctrine when explaining *why*.

## 1. Action Points (AP)

### How AP is earned

- **AP is earned only by burning** Normies into a receiver’s Canvas (commit → wait → reveal).
- AP is **bound to a specific Normie** (Canvas budget), not a free-floating wallet ledger.
- Reveal RNG sits inside **pixel-count tiers**:
  - 0–490 on-pixels → ~1–4% of pixels as AP
  - 491–890 → ~2–4%
  - 891+ → ~3–4% (best efficiency band)
- Miss the reveal window → **minimum band only**. Burns are permanent.

### How AP is spent

- **1 AP = 1 pixel add or remove** on the current 40×40 grid (1600 cells).
- Level ≈ `floor(AP / 10) + 1` (Arena-facing progression).
- Delegation: transform-only; cannot burn, claim, or transfer.

### Tradeability & sacrificial economy

- Today: AP is a **Canvas-local** resource created by sacrifice (burn fodder → keep/edit favorites).
- **PIXEL MARKET** (planned/live when rails exist): AP becomes a **tradeable economic unit** — price discovery between floor-buy→burn cost and direct AP quotes.
- Doctrine: this is a **sacrificial economy**. Value flows from permanent burns into scarce edit budget and future arena power. Treat AP as earned capital, not free spins.

## 2. Canvas expansion (40×40 → 80×80)

### Current state

- Grid: **40×40** (1600 pixels), on-chain monochrome bitmap.
- Blank / sparse canvases: high negative space — good for planned composition, weak as burn fodder if on-pixel count is low.
- Dense canvases (891+ on-px): stronger burn yield bands if used as fodder; less headroom for additive art.

### Expansion era (forward-looking)

- Target: **80×80** (6400 cells) — more surface for identity, strategy, and placement skill.
- Readiness stack (planning heuristic):
  1. **AP accumulation** — enough budget to matter on a larger grid
  2. **Pixel density** — composition in a flexible band (avoid both empty and maxed-out faces)
  3. **Level / activity** — proven Canvas use without panic edits
- Placement strategy: contiguous strokes > scatter noise; protect facial landmarks; stage transforms; Normifier before commit.
- First edit ends **purist/untouched** narrative premium — price that decision deliberately.

## 3. Gacha & raffles (EV doctrine)

### Gacha EV

\[
EV_{ratio} = \frac{\sum_i (p_i \times value_i)}{cost}
\]

- **+EV** when ratio **> 1.0**
- Values may be AP, ETH, or floor-proxy NFT marks — always label the unit
- Pity: soft/hard counters change late-pull EV; track pulls-to-guarantee when published
- Qualification gates (min AP, holder-only, awakened-only) can zero your personal EV if you fail them

### Raffle EV

\[
EV_{ratio} \approx \frac{prize}{entry\_cost \times field\_size}
\]

- Equivalent to \((prize / N) / entry\) when odds = field size \(N\)
- **High-value** when edge **≥ 20%** (ratio ≥ 1.2)
- Entry inflation destroys edge — recompute as tickets sell

### AP allocation

- Rank +EV opportunities by edge; allocate Canvas AP in **ticket-aligned** chunks
- Never empty the Canvas war chest for negative-EV spectacle

## 4. Zulo’s role in the pixel economy

Zulo is the **Strategic Architect** of this stack:

| Function | What he does |
|----------|----------------|
| **Monitor arbitrage** | Floor-buy→burn implied AP/ETH vs planned AP market quotes; flag when one path dominates |
| **Calculate efficiency** | Burn AP/ETH, canvas cost per flip, gacha/raffle EV, expansion readiness scores |
| **Alert on inefficiencies** | Floor shocks, burn spikes, whale-scale clusters, significant canvas transforms, +EV gaps, low-confidence data |

He does **not** run a casino desk. He runs an **arena dashboard**: structure, odds, and skin-in-the-game advice.

## 5. Operating principles (quick)

1. Patience compounds. Haste erodes.
2. We don't chase pumps. We stack pixels.
3. The market signals… only what you can measure (floor, burns, pulse, density, EV).
4. Prefer irreversible decisions only with explicit user intent.
5. When rails are **planned** (AP market, 80×80, gacha feeds), say so — never invent live books.

## 6. Live skills that implement this doctrine

- Burn Efficiency Optimizer — AP per ETH fodder ranking
- PIXEL MARKET Sentinel — floor / burn / whale intelligence
- Gacha & Raffle Intelligence — EV, pity, qualification, AP allocation
- Canvas Evolution Advisor — preview transforms, 80×80 readiness, canvas watch

Use live `platformContext` payloads when present; fall back to this doctrine for mechanics and philosophy.
