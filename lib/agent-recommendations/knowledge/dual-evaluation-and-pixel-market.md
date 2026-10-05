# Dual Evaluation & PIXEL MARKET — Zulo Knowledge

> **Audience:** Always-on Ask / Zulo doctrine (burn vs hold + market status).  
> **Tone:** Calm, DYOR, no FOMO, no financial advice.  
> **Related:** `knowledge/pixel-economy.md`, `lib/knowledge/pixel-currency.md`

---

## 1. PIXEL MARKET (official status)

**Source:** Official **@normiesART** announcement (**August 2026**).

| Fact | Detail |
|------|--------|
| **What Pixel is** | **#PIXEL = Action Points (AP)** — Canvas edit budget. **Not a token.** Not `$PIXEL`. |
| **Status** | **Not open yet** (planned October 5, 2026, audits permitting). Revenue-share rules are OFFICIAL (section 1b); prices and order book are TBA |
| **Live trading?** | **No** — do **not** describe a live order book, live AP/Pixel quotes, or settled peer market |
| **How AP/Pixel is earned today** | By **burning** Normies into a receiver’s Canvas (commit → wait → reveal); Canvas-local budget |
| **Still TBA** | Live prices, order-book depth, exact timing: do not invent buy/sell mechanics or qualification rules. The revenue-share formula is NOT TBA (section 1b) |
| **What Zulo must not invent** | AP prices, hold-threshold **X**, order-book depth, or any standing valuation oracle |

**Language for answers:**

- Prefer: “PIXEL MARKET is **not open yet**; its revenue-share rules are official, its prices and order book are TBA.”
- Prefer: “**#PIXEL is Action Points, not a token** — earned by burning Normies into Canvas.”
- Prefer: official customize uses **#PIXEL as pixel budget** (**1 PIXEL = 1 pixel**) — not an AP debit. AP is not spent when you draw.
- Never: invent ETH/AP market prices, claim a book is open, or imply Zulo is a price oracle. Never tell a visitor AP is spent or debited to change appearance.

PIXEL MARKET Sentinel (in-app skill) remains **floor / burn / whale intelligence** for the Normie collection — it is **not** a live Pixel order book.

## 1b. Pixel Market economics (OFFICIAL, October 2026)

**Source:** the official Pixel Market explainer video on the official Normies page and the official revenue share simulator (simulator.normies.art). Where an older note below says the rules are TBA, THIS section takes precedence.

- **Where the money goes:** Pixel Market sales carry a 10% fee (taken from the seller) and 50% of that fee goes to holders. Normie resales carry a 5% royalty and 50% of the royalties go to holders.
- **When it is paid:** monthly, in rounds (epochs), claimed on chain. Unclaimed ETH returns to the pool after 365 days.
- **What counts:** holdings are checked at four random blocks a day, so what you hold DURING the month counts (hold half the month, earn about half).
- **Your score:** (Normies x bracket multiplier + #PIXEL / 5) x (1 + boost). Brackets by Normies held: 1 = 1.00x, 2 = 1.15x, 5 = 1.30x, 10 = 1.45x, 25 = 1.60x, 50 = 1.75x. Boost by #PIXEL held (on Normies, in the wallet or in listings): 15 = +15%, 100 = +35%, 500 = +60%, 1,500 = +100%. #PIXEL alone earns nothing: you need at least one Normie.
- **Your share:** your score divided by everyone's total score. Real payouts depend on real market volume, so any figure is an estimate, never a promise.
- **Status:** not open yet. Planned for October 5, 2026, audits permitting; that is not guaranteed. Prices, order-book depth and exact timing are still TBA: never invent them.
- **Burn yield (community-sourced):** Serc said in the community chat that burns pay a fixed 4% until about 8 PM Central European time on October 5 (possibly 1 to 2 hours earlier), then return to the normal tiers (0-490 px 1-4%, 491-890 px 2-4%, 891+ px 3-4%). This is NOT from an official @normiesART post: say so, and tell people to check @normiesART.
- **What a burn pays on:** the ORIGINAL pixel count (what the contract uses), not the current edited art. Painting or editing does not raise burn yield. Burning an edited Normie erases that art for good, so an edited Normie is a strong reason to keep.
- **Wallet-specific answers:** point people to https://normiescredhub.vercel.app/burn (an independent community tool, not made by the Normies team; read-only, paste an address) and to the official simulator at https://simulator.normies.art.

---

## 2. Dual evaluation rule (burn vs hold)

Not every Normie is meant to burn. Always weigh **both** frames before recommending sacrifice.

### Burn-efficiency frame

- **High pixel count (e.g. 891+ on-pixels):** generally **better burn efficiency** — typically the higher AP-yield band (~3–4% of pixels as AP on reveal; treat bands as **guidance**, not guarantees).
- Mid bands (e.g. 491–890) and lower bands (e.g. 0–490) are weaker efficiency fodder *all else equal* — still not auto-burn if scarcity or identity dominates.
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
- High-px fodder (891+) is where efficiency framing is usually stronger.  
- DYOR; permanent decision.

### “What is PIXEL MARKET / is it live?”

- Official framing: **#PIXEL = AP, not a token.**  
- Status: **not open yet** (planned October 5, audits permitting; not guaranteed). The revenue-share rules ARE official (section 1b): summarize them briefly. No order book claims; prices and order-book mechanics = TBA.

### “Is Pixel the same as AP?”

- **Yes** — #PIXEL is Action Points (AP). **Not** a tradable token.  
- Earned by burning; Canvas-bound today. #PIXEL counts toward the revenue-share score (section 1b). Prices and order-book mechanics = TBA.

### "How is my share of the Pixel Market revenue calculated?"

- Give the official score formula and brackets (section 1b), the 50% holder split of fees and royalties, the monthly payout and the four random daily checks.
- Say it is an estimate that depends on real volume. Point to https://simulator.normies.art and to https://normiescredhub.vercel.app/burn for a wallet-specific read.

### "Should I burn before the 4% promo ends?"

- The fixed 4% yield window is community-sourced (Serc), not an official post; if it holds it ends around October 5, 8 PM Central European time. Say that plainly.
- No pressure: burns are permanent. Ask for their token IDs, and point to https://normiescredhub.vercel.app/burn for a keep-or-burn read. Never invent other deadlines.

### "Does painting or editing my Normie raise its burn yield?"

- No. A burn pays on the ORIGINAL pixel count. Burning an edited Normie erases the art for good: default to hold unless there is a concrete plan.

---

## 4. Safety

- No FOMO language. No guaranteed returns. No invented AP prices or hold thresholds.  
- Prefer structure over sentiment. *Patience compounds. Haste erodes.*
