/**
 * Conditional loader for Pixel currency knowledge.
 * Does not modify existing knowledge/*.md files under agent-recommendations.
 * Loaded only when PIXEL_CURRENCY_ENABLED=true.
 *
 * Bundled string only (no fs/path) so this module stays edge/client-safe if imported
 * transitively. Authoring source: pixel-currency.md (keep in sync).
 */

import { PIXEL_MARKET_STATUS_LINE } from "@/lib/official-status"
import { isPixelCurrencyEnabled } from "@/lib/payments/config"

/** Bundled copy of pixel-currency.md for serverless / flag-on inject. */
export const PIXEL_CURRENCY_MD = `# Pixel Currency — Zulo Knowledge Base (Scaffolding)

> **Status:** Scaffolded preparation for PIXEL MARKET.
> **Official framing (@normiesART, Aug 2026):** **Pixel = Action Points (AP)**; market: **Pixel Market = LIVE since 2026-10-05 (official)**.
> **Source of truth for live Canvas mechanics:** AP (Pixel) Canvas-local budget.
> **Feature flag:** \`PIXEL_CURRENCY_ENABLED\` (default \`false\`).
> **Default settlement:** \`DEFAULT_CURRENCY=AP\`.
> **Related:** dual-evaluation-and-pixel-market.md, pixel-economy.md.

This document does **not** replace pixel-economy.md or dual-evaluation doctrine. It only frames currency naming / conversion scaffolding for when market rails land.

## 1. Pixel vs AP distinction

| Concept | Today (live) | PIXEL MARKET (live since 2026-10-05) |
|---------|----------------|-------------------------|
| **Action Points (AP)** | Canvas-local transform budget on a specific Normie | Same unit as Pixel per official announcement |
| **Pixel (PIXEL)** | Market-facing name for AP (not a separate live ledger here) | Sell-side listings in ETH per pixel on the official Pixel Market (live) |

**Working assumptions:**

1. **Same unit (default / official framing):** Pixel = AP → **1 AP = 1 PIXEL**.
2. **Different units (only if future oracle docs say so):** conversion via **oracle** (placeholder rate only — never invent live prices).

Zulo must **never invent** live order books, transfer mechanics, hold-threshold X, or non-documented rates.

## 2. Burn mechanics (earn AP / Pixel)

- **Earn only by burning** Normies into a receiver’s Canvas (commit → wait → reveal).
- Yield bands by on-pixel count (under 490, 490–889, 890+).
- Budget is **bound to a Normie Canvas**, not eth_getBalance and not TBA inventory.
- Official customize uses **#PIXEL as pixel budget** (**1 PIXEL = 1 pixel**) in official Normies UI — not an AP debit. AP is not spent when you draw / preview.
- Prefer **Pixel** as primary market term when feature-enabled; keep **AP** as legacy alias and API field name.

## 3. PIXEL MARKET trading (live since 2026-10-05)

- Venue: the official Pixel Market (https://www.normies.art/lab/pixel-market). CredHub has no live prices.
- Burn Efficiency / Market Sentinel still quote **AP per ETH** as the measurable proxy.
- Manifest: \`payment.pixelCurrencyStatus\` scaffolded; \`payment.conversionOracle\` planned until rails live.

## 4. Conversion scenarios

- **Same unit (default):** 1 AP = 1 PIXEL (\`PIXEL_CONVERSION_MODE=same-unit\`).
- **Oracle:** PIXEL = AP × placeholder rate (\`PIXEL_AP_ORACLE_RATE\`); never present as live market price.
- Migration: keep AP workflows; advertise both currencies; enforce AP until flag + rails.

## 5. Safety rules

1. Flag off → speak in AP; note Pixel = AP and the Pixel Market is live (official) when asked.
2. Flag on / scaffolded → dual vocabulary OK; never claim enforced Pixel settlement or live books.
3. Never break burn-efficiency or Canvas math denominated in AP.
4. Prefer: “Pixel is AP; the Pixel Market is live (official), and CredHub has no live prices.”

*Patience compounds. Haste erodes.*
`

/** Full markdown when flag enabled; empty string when disabled. */
export function loadPixelCurrencyKnowledge(): string {
  if (!isPixelCurrencyEnabled()) return ""
  return PIXEL_CURRENCY_MD.trim()
}

/** Prompt block — only injected when Pixel currency feature is on. */
export function buildPixelCurrencyPromptBlock(): string {
  const md = loadPixelCurrencyKnowledge()
  if (!md) return ""
  return `=== PIXEL CURRENCY KNOWLEDGE (scaffolded — feature flag ON) ===
${md}

CURRENCY ENFORCEMENT:
- Live Canvas math and burn efficiency remain AP-denominated
- Prefer "Pixel" as market-facing primary term; "AP" as legacy alias
- Do not invent live PIXEL MARKET books or non-1:1 rates without oracle docs
- conversionOracle is planned unless context says live`
}

/** Compact summary for platformContext (null when disabled). */
export function getPixelCurrencyContextSummary(): {
  title: string
  status: string
  pillars: string[]
  conversion: string[]
  principles: string[]
  source: string
} | null {
  if (!isPixelCurrencyEnabled()) return null
  return {
    title: "Pixel Currency (scaffolded)",
    status: "scaffolded",
    pillars: [
      "Pixel = AP (official @normiesART, Aug 2026)",
      PIXEL_MARKET_STATUS_LINE,
      "AP remains Canvas-local; trade only on the official Pixel Market",
      "Default: 1 AP = 1 PIXEL (same-unit mode)",
    ],
    conversion: [
      "same-unit: identity rate (default)",
      "oracle: placeholder PIXEL_AP_ORACLE_RATE until live feed",
      "conversionOracle status: planned",
    ],
    principles: [
      "Never invent live Pixel order books or hold-threshold X",
      "Burn efficiency stays AP-denominated",
      "Pixel primary term / AP legacy alias when flag on",
    ],
    source: "lib/knowledge/pixel-currency.md",
  }
}

/** Whether knowledge/prompt injection should include Pixel currency docs. */
export function shouldInjectPixelCurrencyKnowledge(): boolean {
  return isPixelCurrencyEnabled()
}
