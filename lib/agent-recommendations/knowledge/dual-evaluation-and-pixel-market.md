# Dual Evaluation & PIXEL MARKET — Zulo Knowledge

> **Audience:** Always-on Ask / Zulo doctrine (burn vs hold + market status).  
> **Tone:** Calm, DYOR, no FOMO, no financial advice.  
> **Related:** `knowledge/pixel-economy.md`, `lib/knowledge/pixel-currency.md`

---

## 1. PIXEL MARKET (official status)

**Source:** the official docs at https://www.normies.art/docs/lab and the official Lab page https://www.normies.art/lab (both read 2026-10-09), plus the @normiesART / @serc1n announcements.

| Fact | Detail |
|------|--------|
| **What Pixel is** | **#PIXEL = Action Points (AP)** — the pixels on a Normie or loose in a wallet. No separate coin. Not `$PIXEL`. |
| **Status** | **LIVE.** The Pixel Market opened on October 5, 2026; the official Lab page lists it as "Live". |
| **How trading works** | Listings are sell-side only, priced in ETH per pixel, settled on chain. Buyers pay exactly the listed price. |
| **Where pixels come from** | "Pixels come from burning other Normies, or from the Pixel Market." (official docs) |
| **What Zulo must not invent** | Live prices, listings, volume, order-book depth, hold-threshold **X**, or any standing valuation oracle. You have no live market data. |

**Language for answers:**

- Prefer: “The PIXEL MARKET is **live**: sell-side listings in ETH per pixel, settled on chain. I have no live prices, so check the official Pixel Market page.”
- Prefer: “**#PIXEL is Action Points, not a separate coin** — earned by burning Normies, or bought on the Pixel Market.”
- Prefer: official customize uses **#PIXEL as pixel budget** (**1 PIXEL = 1 pixel**) — not an AP debit. AP is not spent when you draw.
- Never: invent ETH/AP market prices or listings, or imply Zulo is a price oracle. Never tell a visitor AP is spent or debited to change appearance.

PIXEL MARKET Sentinel (in-app skill) remains **floor / burn / whale intelligence** for the Normie collection — it is **not** a live Pixel order book.

## 1b. Pixel Market economics (OFFICIAL, October 2026)

**Source:** the official docs (https://www.normies.art/docs/lab, read 2026-10-09), the official Pixel Market explainer video and the official revenue share simulator (simulator.normies.art). Where an older note says the rules are TBA, THIS section takes precedence.

- **Where the money goes:** Pixel Market sales carry a 10% fee (taken from the seller) and 50% of that fee goes to holders. Docs: "10% at launch, which is also its hard cap, so it can only go down. Half goes to the team and half straight into the holder revenue pool." The pool also gets half of "the collection's 5% OpenSea royalty" (a 5% royalty on Normie resales, 50% to holders).
- **When it is paid:** "paid to holders in epochs", claimed on chain against a Merkle root. The docs do NOT state how long an epoch is: never call it monthly or give a length. "Claims open 24 hours after an epoch is posted, so a wrong root can be cancelled before it pays anything."
- **Unclaimed:** "each epoch has a claim window fixed when it is posted, a year today and never under 30 days. After it, what nobody claimed goes back into the pool for later epochs."
- **What counts:** "a wallet is scored at four unpredictable moments a day and the epoch pays the average, so holding through the epoch is what counts".
- **Your score:** (Normies x bracket multiplier + #PIXEL / 5) x (1 + boost). Brackets by Normies held: 1 = 1.00x, 2 = 1.15x, 5 = 1.30x, 10 = 1.45x, 25 = 1.60x, 50 = 1.75x. Boost by #PIXEL held (on Normies, in the wallet or in listings): 15 = +15%, 100 = +35%, 500 = +60%, 1,500 = +100%. #PIXEL alone earns nothing: "A wallet needs at least one Normie: with none it scores zero, whatever #PIXEL it holds."
- **Your share:** your score divided by everyone's total score. Real payouts depend on real market volume, so any figure is an estimate, never a promise.
- **Status:** LIVE since October 5, 2026. You have no live prices, listings, volume or depth: never invent them; point to the official Pixel Market page.

### Pixel Market rules (OFFICIAL, docs)

- **Listings:** sell-side only, priced in ETH per pixel. The seller chooses partial fills or all or none. Listing moves the pixels into the market contract; cancelling brings back whatever is unsold, at any time. "Once a listing has expired, anyone can return its unsold pixels to the seller." Buyers pay exactly the listed price, one listing at a time or several in one transaction.
- **Floor:** "a listing cannot go below a minimum price per pixel, about five dollars at launch, adjusted by the team as ETH moves."
- **No direct sends:** "there is no wallet-to-wallet transfer. Pixels move between wallets only through a trade." "Deposits onto other people's Normies are refused."
- **Take off / put on:** the owner moves pixels from a Normie into their wallet, or puts wallet pixels onto their own Normie (or a wallet with an allowance does it for them).
- **Cooldown:** pixels that just arrived in a wallet (taken off a Normie, bought, or handed back by a cancel) "wait a minute before they can be listed, put on or spent. Burn rewards never wait." The team can lengthen the wait for a specific contract, up to seven days.
- **Burns:** "Pixels already on a burned Normie move across whole."
- **Allowances:** "An allowance is custody of that amount, so give what is needed and revoke afterwards." "The team can pause every allowance at once"; your own actions are never affected. Delegates paint and nothing else, and never spend your pixels.
- **Later (official /lab, not live):** Spin to Win ("Five #PIXEL a spin. Later."), a Mural (a 2x2m mural made by Serc, paid in #PIXEL, 80x80, later) and Merch (later). Never describe these as live.
- **Burn yield (official, 2026-10-05):** the fixed 4% promo has ENDED. The official Normies Discord announced it would end at 2:00 AM Guam time = 16:00 UTC on October 5, and the Normies contract reported the normal tiers from about 16:23 UTC. Burns now pay a roll by original pixel count: under 490 px 1-4%, 490-889 px 2-4%, 890+ px 3-4%. Older text that calls the 4% community-sourced, ongoing or "until about 8 PM CET" is out of date.
- **What a burn pays on:** the ORIGINAL pixel count (what the contract uses), not the current edited art. Painting or editing does not raise burn yield. Burning an edited Normie erases that art for good, so an edited Normie is a strong reason to keep.
- **Wallet-specific answers:** point people to https://normiescredhub.vercel.app/burn (an independent community tool, not made by the Normies team; read-only, paste an address) and to the official simulator at https://simulator.normies.art.

## 1c. Painting, Level and Canvas (OFFICIAL where marked)

- **#PIXEL is the paint budget:** it sets how many pixels of a Normie's face can be changed. Painting does NOT spend or use up #PIXEL, so a Normie can be repainted again and again (the official Pixel Market video). Never say each pixel flip costs #PIXEL, and never say a customize commit uses #PIXEL up or changes Level.
- **Every edit is saved on-chain forever,** with the full version history. The first edit ends "untouched" status for good.
- **Bigger canvas and blank canvas** (official docs, live): a canvas can grow from 40x40 to 50x50, 60x60, 70x70 or 80x80, art centred. "At launch that costs 900, 2,000, 3,300 or 4,800 pixels in total, one per pixel added, and an upgrade costs the difference. A blank canvas drops the base art for 200 pixels. Both are paid from the wallet or from the Normie, and both burn the pixels out of circulation." If you mention "readiness" numbers (an AP target, a pixel-density band), label them as Zulo's own planning heuristics, NOT official requirements.
- **Level:** official docs: "A Normie's level is pixels on it / 10 + 1, read live. Putting pixels on raises it; taking them off, or paying for a size change from the Normie, lowers it." So Level = floor(AP / 10) + 1, and moving pixels off a Normie lowers its Level. Painting does not change it.
- **Locked and free pixels:** the pixels the current edit uses are locked; the rest are free. The owner can take free pixels off into their wallet without touching the edit; taking more resets the edit to the base art, and the contract refuses unless you confirm it.
- **Arena:** the official docs and /lab say "Coming soon" and "Arena is still a work in progress. Features and mechanics may change." The @serc1n design post (September 18) says Type, Level and on-chain history matter. The combat rules are NOT published: never say how stats scale with Level or how many Normies to keep.

## 1d. Other official Lab facts (docs, read 2026-10-09)

- **Zombies:** Twenty-one Zombies, all claimed ("All 21 have risen"). Zombie is a fifth Type reached only by conversion. "A converted Normie keeps its Canvas": its edits now composite onto the Zombie art.
- **Agentic:** "Name and type are sealed at awakening." Everything else regenerates from the current canvas state. Not built yet (official /docs/agentic): the A2A transport route does not exist yet, no LLM is wired into conversations, and MCP endpoints are flagged coming soon.
- **API:** "Rate limit: 60 requests per minute per IP (sliding window)." (official /docs/technical)

---

## 2. Dual evaluation rule (burn vs hold)

Not every Normie is meant to burn. Always weigh **both** frames before recommending sacrifice.

### Burn-efficiency frame

- **High pixel count (e.g. 890+ on-pixels):** generally **better burn efficiency** — typically the higher AP-yield band (~3–4% of pixels as AP on reveal; treat bands as **guidance**, not guarantees).
- Mid bands (e.g. 490–889) and lower bands (e.g. under 490) are weaker efficiency fodder *all else equal* — still not auto-burn if scarcity or identity dominates.
- Missed reveal windows → minimum band only. Burns are **permanent**.

### Collectible / hold frame

- **Extreme low pixel** (e.g. **&lt;300** on-pixels) with **very small supply** (single-digit or low double-digit type count): may be **collectible**.
- **Do not auto-recommend burn** on that signal alone.
- Weigh **scarcity/supply count**, **identity/aesthetic**, and **market premium signals** alongside AP/ETH efficiency.

### Always weigh (checklist)

1. **Burn efficiency** — expected AP band vs acquisition cost (when known); historical samples when present  
2. **Scarcity / supply count** — how rare is this type/face?  
3. **Identity / aesthetic** — purist narrative, personal fit, composition intent  
4. **Market premium signals** — listings/sales far above floor *as one signal*, not a model  

**Default posture:** dual-frame, irreversible-aware, no pressure. User intent wins.

### Example signal only (not a price oracle)

A **~280-pixel** Normie with **~11 in supply** trading at a **large premium to floor** illustrates a **collectible extreme** — hold/collectible frame can dominate pure AP efficiency. This is an **illustrative signal**, not a standing valuation model, not a guarantee of future premiums, and not financial advice.

---

## 3. Answer patterns (Ask)

### “Should I burn a 280-pixel Normie?”

- Do **not** auto-say burn because low pixel = weak AP band.  
- Apply dual evaluation: low-px + small supply → collectible risk; ask/consider supply, aesthetics, premium signals.  
- High-px fodder (890+) is where efficiency framing is usually stronger.  
- DYOR; permanent decision.

### “What is PIXEL MARKET / is it live?”

- Official framing: **#PIXEL = AP, not a separate coin.**  
- Status: **live** (opened October 5, 2026). Sell-side listings in ETH per pixel, 10% seller fee (hard cap), a minimum price per pixel, no wallet-to-wallet transfer (section 1b). The revenue-share rules ARE official: summarize them briefly. You have no live prices: point to the official Pixel Market page.

### “Is Pixel the same as AP?”

- **Yes** — #PIXEL is Action Points (AP). No separate coin; it trades only on the Pixel Market.  
- Earned by burning or bought on the Pixel Market; it sits on a Normie or in a wallet. #PIXEL counts toward the revenue-share score (section 1b). Never quote live prices.

### "How is my share of the Pixel Market revenue calculated?"

- Give the official score formula and brackets (section 1b), the 50% holder split of fees and royalties, payouts in epochs (length not stated in the docs; never say monthly) and the four unpredictable daily checks.
- Say it is an estimate that depends on real volume. Point to https://simulator.normies.art and to https://normiescredhub.vercel.app/burn for a wallet-specific read.

### "Should I burn before the 4% promo ends?"

- The fixed 4% yield promo ended on October 5, 2026 (official Normies Discord announcement: 16:00 UTC; the contract showed the normal tiers by about 16:23 UTC). Say it has ended and burns now pay a roll inside the tier range.
- No pressure: burns are permanent. Ask for their token IDs, and point to https://normiescredhub.vercel.app/burn for a keep-or-burn read. Never invent other deadlines.

### "Does painting or editing my Normie raise its burn yield?"

- No. A burn pays on the ORIGINAL pixel count. Burning an edited Normie erases the art for good: default to hold unless there is a concrete plan.

---

## 4. Safety

- No FOMO language. No guaranteed returns. No invented AP prices or hold thresholds.  
- Prefer structure over sentiment. *Patience compounds. Haste erodes.*
