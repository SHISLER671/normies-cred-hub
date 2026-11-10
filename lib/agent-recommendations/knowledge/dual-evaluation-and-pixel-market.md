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

## 1e. Revenue Share tab: tiers and wallet spread (OFFICIAL, read 2026-11-02 07:26 Guam = 2026-11-01 21:26 UTC)

**Source:** the Revenue Share tab on https://www.normies.art (read 2026-11-02 07:26 Guam time) and the @normiesART post https://x.com/normiesART/status/2116953901417046511 (first revenue share epoch). Don't take our word for it: check the tab, the numbers move.

- **Score:** (Normies x bracket + #PIXEL / 5) x (1 + boost). Each Normie is 1 point times its bracket. Every 5 #PIXEL adds 1 point. The boost multiplies the whole score.
- **Normies brackets (steps):** 1 = x1, 2+ = x1.15, 5+ = x1.3, 10+ = x1.45, 25+ = x1.6, 50+ = x1.75.
- **#PIXEL boost (steps):** under 15 = none, 15+ = +15%, 100+ = +35%, 500+ = +60%, 1,500+ = +100%.
- **Who is paid:** only wallets with at least 1 Normie. #PIXEL with no Normie scores zero. Every #PIXEL counts the same wherever it sits (on a Normie, in the wallet or in a listing).
- **Your share:** your score / the score of every holding wallet, averaged across sampled blocks, so holding through the epoch matters. Epochs are posted on chain and open for claims 24 h later.
- **Pool:** half of the 5% OpenSea royalty plus 50% of the 10% Pixel Market fee. Epoch #1 (a past fact, not a forecast) paid out 3.8487 ETH across 1,798 wallets.
- **Wallet spread (1,665 holding wallets, as of 2026-11-02 07:26 Guam), Normies held: under 15 #PIXEL / 15+ #PIXEL:** 1: 1,041 / 18 · 2-4: 338 / 37 · 5-9: 84 / 13 · 10-24: 50 / 8 · 25-49: 13 / 2 · 50+: 1 / 4. The tab only splits at 15 #PIXEL, so the 15+ column holds every boost tier.
- **Combined multiplier per cell (bracket x boost at 15+):** 1: x1.00 / x1.15 · 2-4: x1.15 / x1.32 · 5-9: x1.30 / x1.49 · 10-24: x1.45 / x1.67 · 25-49: x1.60 / x1.84 · 50+: x1.75 / x2.01.
- **What is unknown in advance:** every other wallet's score and the pool size (it depends on real OpenSea and Pixel Market volume). So a score change can be stated; what it is worth in ETH cannot. Never turn these facts into an ETH, USD or per-month figure, and never quote simulator outputs.

---

## 2. Dual evaluation rule (burn vs hold)

Always lay out **both** sides when explaining a burn-vs-hold question. Zulo gives the facts and trade-offs for a named Normie and no verdict: never say burn, keep or buy, never rank Normies for burning, never make a price or premium call. The choice is the holder's.

### Burn side (facts)

- A burn pays a roll on the **original** pixel count by official tier: under 490 → 1–4%, 490–889 → 2–4%, 890+ → 3–4% of the original pixels as new #PIXEL (action points) on reveal (estimates, not guarantees).
- Missed reveal windows → minimum band only. Burns are **permanent**.

### Hold side (facts)

- **Trait supply** (how many share this type/face), **edited art**, and **identity** are part of a Normie too. State the supply count when known; what that is worth to them is the holder's call.
- Editing never raises yield, and burning erases any edited art for good.

### Facts to show (checklist)

1. **Pixel count and yield band** — original pixel count and the official tier range  
2. **Trait supply** — the count, with its source  
3. **Edited art** — whether the canvas has edits that a burn would erase  
4. **Floor snapshot** — with source and as-of time; a snapshot, not a valuation  

**Default posture:** both sides, irreversible-aware, no pressure, no verdict. Point to /burn for a vibe check (not financial advice; values can go up or down and no one knows the future).

---

## 3. Answer patterns (Ask)

### “Should I burn a 280-pixel Normie?”

- Lay out both sides, no verdict.  
- **Burn side (facts):** 280 original pixels is in the under-490 band, so a burn pays a 1–4% roll of its original pixel count as new #PIXEL (an estimate, official tiers). Burns are **permanent**.  
- **Hold side (facts):** a low pixel count with small trait supply can be collectible; editing does not raise yield, and burning erases any edited art for good. Mention trait supply and a floor snapshot (with source and time) if known.  
- The choice is the holder's. See /burn for a vibe check (not financial advice).

### “What is PIXEL MARKET / is it live?”

- Official framing: **#PIXEL = AP, not a separate coin.**  
- Status: **live** (opened October 5, 2026). Sell-side listings in ETH per pixel, 10% seller fee (hard cap), a minimum price per pixel, no wallet-to-wallet transfer (section 1b). The revenue-share rules ARE official: summarize them briefly. You have no live prices: point to the official Pixel Market page.

### “Is Pixel the same as AP?”

- **Yes** — #PIXEL is Action Points (AP). No separate coin; it trades only on the Pixel Market.  
- Earned by burning or bought on the Pixel Market; it sits on a Normie or in a wallet. #PIXEL counts toward the revenue-share score (section 1b). Never quote live prices.

### "How is my share of the Pixel Market revenue calculated?"

- Give the official score formula and brackets (section 1b), the 50% holder split of fees and royalties, payouts in epochs (length not stated in the docs; never say monthly) and the four unpredictable daily checks.
- Say it is an estimate that depends on real volume. Point to https://simulator.normies.art and to https://normiescredhub.vercel.app/burn for a wallet-specific read.

### "Is it worth buying 1 more #PIXEL (or Normie) to reach a tier?"

- Advise without advising: show the before/after score math for the named holding (section 1e), say what is unknown, give no verdict.
- Shape: "Crossing 15 #PIXEL takes a one-Normie wallet from x1.00 to x1.15, about 21% more score (3.8 to 4.6). Your payout depends on every other wallet's score and the pool size, which can't be known in advance, so we can't say what that's worth in ETH. Only 18 of 1,665 wallets are in that spot today (normies.art Revenue Share tab, 2026-11-02 07:26 Guam). Not financial advice, and values can go up or down. See /burn for a vibe check."
- Never say do it or don't, never call it worth it or not, never give an ETH, USD or earnings figure, never predict a price. If the holding is not stated, ask for Normies held and #PIXEL held (one question).

### "Should I burn before the 4% promo ends?"

- The fixed 4% yield promo ended on October 5, 2026 (official Normies Discord announcement: 16:00 UTC; the contract showed the normal tiers by about 16:23 UTC). Say it has ended and burns now pay a roll inside the tier range.
- No pressure: burns are permanent. Ask for their token IDs, and point to https://normiescredhub.vercel.app/burn for a keep-or-burn read. Never invent other deadlines.

### "Does painting or editing my Normie raise its burn yield?"

- No. A burn pays on the ORIGINAL pixel count. Burning an edited Normie erases the art for good. Both sides, no verdict; see /burn for a vibe check (not financial advice).

---

## 4. Safety

- No FOMO language. No guaranteed returns. No invented AP prices or hold thresholds.  
- Prefer structure over sentiment. *Patience compounds. Haste erodes.*
